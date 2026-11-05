import { Management } from 'auth0';
import { isEqual } from 'lodash';
import ValidationError from '../../validationError';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import DefaultAPIHandler, { order, retryWithExponentialBackoff } from './default';
import { paginate } from '../client';
import { shouldExcludeThirdPartyClients } from '../../utils';
import { isDynamicCimdClient } from './clients';
import log from '../../../logger';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
      },
      clients: {
        type: 'array',
        description:
          'Names of the clients linked to this agent. Omit to leave links untouched. Removing clients (or []) unlinks them only when AUTH0_ALLOW_DELETE is true.',
        items: { type: 'string' },
        uniqueItems: true,
      },
      external_agent_id: {
        type: 'string',
        description: 'Can only be set when the agent is created.',
      },
      metadata: {
        type: 'object',
      },
    },
    required: ['name'],
  },
};

export type Agent = Management.AgentResponseContent & { clients?: string[] };

// Agent names are not unique on the tenant
export const findDuplicateNames = (agents: { name?: string }[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  agents.forEach(({ name }) => {
    if (name === undefined) return;
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  });
  return [...duplicates];
};

// Clients from the list call always have a client_id and name
type ClientWithAgent = Management.Client & {
  client_id: string;
  name: string;
};

type ClientLinkPlan = {
  links: { client: ClientWithAgent; agentId: string; agentName: string }[];
  // Clients dropped from an agent's `clients` list and not moving to another agent
  removals: { client: ClientWithAgent; agentName: string }[];
  // Names of the Deploy CLI's own client, left out of links and removals
  skippedDeployClient: string[];
};

const isInsufficientScopeError = (err): boolean =>
  err?.statusCode === 403 &&
  (err?.body?.errorCode === 'insufficient_scope' || !!err?.message?.includes('Insufficient scope'));

const isFeatureNotEnabledError = (err): boolean =>
  err?.statusCode === 403 && err?.body?.errorCode === 'feature_not_enabled';

const quoteList = (names: string[]): string => names.map((n) => `"${n}"`).join(', ');

export default class AgentsHandler extends DefaultAPIHandler {
  existing: Agent[] | null;

  // Why agents can't be read on this tenant, when the API reports they are unavailable
  private agentsUnavailable: string | null = null;

  private tenantClients: ClientWithAgent[] | null = null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'agents',
      id: 'agent_id',
      identifiers: ['agent_id', 'name'],
      stripCreateFields: ['clients', 'created_at', 'updated_at'],
      stripUpdateFields: ['clients', 'external_agent_id', 'created_at', 'updated_at'],
      functions: {
        delete: (agentId: string) => this.deleteAgent(agentId),
      },
    });
  }

  objString(item): string {
    return super.objString({ name: item.name });
  }

  async getType(): Promise<Agent[] | null> {
    if (this.existing || this.agentsUnavailable) return this.existing;

    let agents: Management.AgentResponseContent[];
    try {
      agents = await this.listAgents();
    } catch (err) {
      if (isFeatureNotEnabledError(err)) {
        log.debug(
          'Agents are not enabled for this tenant. Contact Auth0 support to enable the agents_as_principals_limited_ea feature.'
        );
        this.agentsUnavailable =
          'not enabled for this tenant. Contact Auth0 support to enable the agents_as_principals_limited_ea feature';
        return null;
      }
      // Endpoint not available on this tenant or region; skip like other EA handlers so the
      // rest of the export still works
      if (err.statusCode === 404 || err.statusCode === 501) {
        log.debug(`Agents API is not available on this tenant (HTTP ${err.statusCode}).`);
        this.agentsUnavailable = `not available on this tenant (HTTP ${err.statusCode})`;
        return null;
      }
      throw err;
    }

    // No agents, so no links to resolve
    if (agents.length === 0) {
      this.existing = [];
      return this.existing;
    }

    // Agent names are not unique on the tenant, but agents are matched by name
    const duplicateNames = findDuplicateNames(agents);
    if (duplicateNames.length > 0) {
      log.warn(
        `Multiple agents share the name(s) ${quoteList(
          duplicateNames
        )}. Agents are matched by name, so rename them to manage them from configuration.`
      );
    }

    // Represent client links by client name so they are portable across tenants.
    // Excluded and dynamic CIMD clients are not exported, so their names are left out.
    const clients = await this.listClients();
    const duplicateClientNames = findDuplicateNames(clients);
    if (duplicateClientNames.length > 0) {
      log.warn(
        `Multiple clients share the name(s) ${quoteList(
          duplicateClientNames
        )}. Clients are linked to agents by name, so rename them to manage their agent links from configuration.`
      );
    }
    this.existing = agents.map((agent) => ({
      ...agent,
      clients: [
        ...new Set(clients.filter((c) => c.agent_id === agent.agent_id).map((c) => c.name)),
      ],
    }));

    return this.existing;
  }

  async validate(assets: Assets): Promise<void> {
    await super.validate(assets);

    const { agents } = assets;
    if (!Array.isArray(agents)) return;

    // A client can only be linked to one agent at a time
    const ownerByClient = new Map<string, string>();
    agents.forEach((agent) => {
      (agent.clients || []).forEach((clientName: string) => {
        const owner = ownerByClient.get(clientName);
        if (owner && owner !== agent.name) {
          throw new ValidationError(
            `Client "${clientName}" is linked to both agent "${owner}" and agent "${agent.name}". A client can only be linked to one agent.`
          );
        }
        ownerByClient.set(clientName, agent.name);
      });
    });
  }

  // Run the same checks as a real import so the preview fails where the import would.
  // Read-only: only list calls are made here.
  async dryRunChanges(assets: Assets): Promise<CalculatedChanges> {
    const { agents } = assets;
    if (!agents) return super.dryRunChanges(assets);

    const existing = await this.loadExisting(agents);
    if (existing === null) return { del: [], create: [], conflicts: [], update: [] };
    this.assertNamesUnambiguous(agents, existing);
    this.assertExternalAgentIdsUnchanged(agents, existing);

    const desiredLinks = this.getDesiredLinks(agents);
    const allowDelete = this.isDeleteAllowed();

    // Only list clients when links or deletes need them. The clients handler runs first in a real
    // import, so check against the clients it will leave on the tenant and the ones it will create.
    let clients: ClientWithAgent[] | null = null;
    if (desiredLinks.size > 0) {
      clients = this.getClientsKeptByImport(assets, await this.listClients());
      this.assertClientsExist(agents, clients, this.getClientsCreatedByImport(assets));
    }

    const changes = await super.dryRunChanges(assets);
    this.addMetadataUpdates(agents, existing, changes);

    if (clients) {
      const agentIdByName = new Map(existing.map((a) => [a.name, a.agent_id]));
      const { removals, skippedDeployClient } = this.planClientLinks(
        desiredLinks,
        agentIdByName,
        clients
      );
      this.reportRemovals(removals, allowDelete);
      this.reportSkippedDeployClient(skippedDeployClient);
    }

    if (allowDelete && changes.del.length > 0) {
      const tenantClients =
        clients || this.getClientsKeptByImport(assets, await this.listClients());
      changes.del.forEach((agent) => {
        const linkedClients = tenantClients.filter((c) => c.agent_id === agent.agent_id);
        this.reportSkippedDeployClient(
          linkedClients.filter((c) => this.isDeployClient(c)).map((c) => c.name)
        );
        const linked = linkedClients.filter((c) => !this.isDeployClient(c)).map((c) => c.name);
        if (linked.length > 0) {
          log.warn(
            `Deleting agent "${agent.name}" will first unlink client(s) ${quoteList(
              linked
            )}. The clients are kept.`
          );
        }
      });
    }

    return changes;
  }

  @order('60') // Run after clients so linked clients exist
  async processChanges(assets: Assets): Promise<void> {
    const { agents } = assets;

    // Do nothing if not set
    if (!agents) return;

    const existing = await this.loadExisting(agents);
    if (existing === null) return;
    this.assertNamesUnambiguous(agents, existing);
    this.assertExternalAgentIdsUnchanged(agents, existing);

    // Snapshot desired links before the default flow strips `clients` from payloads
    const desiredLinks = this.getDesiredLinks(agents);

    // Re-fetch so clients created earlier in this import can be linked
    if (desiredLinks.size > 0) {
      this.tenantClients = await this.listClients();
      this.assertClientsExist(agents, this.tenantClients);
    }

    const { del, update, create, conflicts } = await this.calcChanges(assets);
    // With --dry-run --apply, calcChanges uses the dry-run comparison, so apply what the preview showed
    this.addMetadataUpdates(agents, existing, { del, update, create, conflicts });

    // Deletes unlink clients first. Load them before the delete pool starts: listing clients
    // also uses the pool, so listing from inside a delete task can deadlock it.
    if (del.length > 0 && this.isDeleteAllowed() && !this.tenantClients) {
      this.tenantClients = await this.listClients();
    }

    await super.processChanges(assets, { del, update, create, conflicts });

    if (desiredLinks.size > 0) {
      await this.syncClientLinks(desiredLinks);
    }
  }

  // Returns null when there is nothing to do: an empty `agents` list on a tenant where
  // agents can't be read (e.g. a zero-agent export promoted to a tenant without the feature).
  private async loadExisting(agents: Asset[]): Promise<Agent[] | null> {
    let existing: Agent[] | null;
    try {
      existing = await this.getType();
    } catch (err) {
      if (agents.length === 0 && isInsufficientScopeError(err)) {
        log.warn(
          'Skipping agents: the configuration has no agents and agents cannot be read on this tenant.'
        );
        return null;
      }
      throw err;
    }

    if (existing === null) {
      if (agents.length === 0) return null;
      throw new Error(`Agents are configured but the Agents API is ${this.agentsUnavailable}.`);
    }

    return existing;
  }

  // `metadata` is replaced as a whole on update, so a key removed from the config is a change
  // even though the dry-run comparison only looks at keys present in the config
  private addMetadataUpdates(agents: Asset[], existing: Agent[], changes: CalculatedChanges): void {
    agents.forEach((agent) => {
      if (agent.metadata === undefined) return;
      const remote = existing.find((a) => a.name === agent.name);
      if (!remote || isEqual(remote.metadata || {}, agent.metadata)) return;
      if ([...changes.update, ...changes.conflicts].some((a) => a.name === agent.name)) return;
      changes.update.push({ ...agent, agent_id: remote.agent_id });
    });
  }

  private isDeleteAllowed(): boolean {
    return (
      this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true
    );
  }

  private getDesiredLinks(agents: Asset[]): Map<string, string[]> {
    return new Map<string, string[]>(
      agents
        .filter((agent) => Array.isArray(agent.clients))
        .map((agent) => [agent.name, [...agent.clients]])
    );
  }

  // Whether the clients handler processes `assets.clients` in this import
  private isClientsHandlerRunning(assets: Assets): boolean {
    const excludedTypes: string[] = this.config('AUTH0_EXCLUDED') || [];
    const includedOnly: string[] | undefined = this.config('AUTH0_INCLUDED_ONLY');
    if (excludedTypes.includes('clients')) return false;
    if (includedOnly !== undefined && !includedOnly.includes('clients')) return false;
    return Array.isArray(assets.clients);
  }

  // The client the Deploy CLI authenticates with; the clients handler never modifies it
  private isDeployClient(client: { client_id?: string }): boolean {
    const deployClientId = this.config('AUTH0_CLIENT_ID');
    return !!deployClientId && client.client_id === deployClientId;
  }

  // Names of clients the clients handler will create or update in this import.
  // Same filters as the clients handler applies to its changes.
  private getClientsCreatedByImport(assets: Assets): string[] {
    if (!this.isClientsHandlerRunning(assets)) return [];

    const excludedClients = this.getExcludedClientNames(assets);
    return (assets.clients || [])
      .filter((c) => !shouldExcludeThirdPartyClients(this.config) || c.is_first_party)
      .map((c) => c.name as string)
      .filter((name) => name !== undefined && !excludedClients.includes(name));
  }

  // Tenant clients still there after the clients handler runs: with AUTH0_ALLOW_DELETE it deletes
  // the managed clients missing from the config. tenantClients is already filtered by listClients.
  private getClientsKeptByImport(
    assets: Assets,
    tenantClients: ClientWithAgent[]
  ): ClientWithAgent[] {
    if (!this.isClientsHandlerRunning(assets) || !this.isDeleteAllowed()) return tenantClients;

    const configured = assets.clients || [];
    return tenantClients.filter(
      (client) =>
        this.isDeployClient(client) ||
        configured.some((c) => c.client_id === client.client_id || c.name === client.name)
    );
  }

  private getExcludedClientNames(assets?: Assets): string[] {
    return [
      ...(this.config('AUTH0_EXCLUDED_CLIENTS') || []),
      ...((assets?.exclude && assets.exclude.clients) || []),
    ];
  }

  private async listAgents(): Promise<Management.AgentResponseContent[]> {
    return paginate<Management.AgentResponseContent>(this.client.agents.list, {
      checkpoint: true,
      take: 100,
    });
  }

  // Same filters as the clients handler: excluded and dynamic CIMD clients are never managed
  private async listClients(): Promise<ClientWithAgent[]> {
    const excludedClients = this.getExcludedClientNames();
    const clients = await paginate<ClientWithAgent>(this.client.clients.list, {
      paginate: true,
      is_global: false,
    });

    return clients.filter(
      (client) =>
        !isDynamicCimdClient(client) &&
        !excludedClients.includes(client.name) &&
        (!shouldExcludeThirdPartyClients(this.config) || client.is_first_party)
    );
  }

  private setClientAgent(client: ClientWithAgent, agentId: string | null) {
    return this.client.clients.update(client.client_id, { agent_id: agentId });
  }

  // DELETE /agents/{id} keeps linked clients but leaves their agent_id pointing at
  // the deleted agent. Unlink them first so no client references a missing agent.
  // tenantClients is loaded by processChanges before deletes run; never list here.
  private async deleteAgent(agentId: string): Promise<void> {
    const linked = (this.tenantClients || []).filter((c) => c.agent_id === agentId);
    this.reportSkippedDeployClient(linked.filter((c) => this.isDeployClient(c)).map((c) => c.name));

    for (const client of linked.filter((c) => !this.isDeployClient(c))) {
      await this.setClientAgent(client, null);
      delete client.agent_id;
      log.info(`Unlinked client "${client.name}" from deleted agent [${agentId}]`);
    }

    await this.client.agents.delete(agentId);
  }

  private planClientLinks(
    desiredLinks: Map<string, string[]>,
    agentIdByName: Map<string, string>,
    clients: ClientWithAgent[]
  ): ClientLinkPlan {
    const clientByName = new Map(clients.map((c) => [c.name, c]));
    const links: ClientLinkPlan['links'] = [];
    const dropped: ClientLinkPlan['removals'] = [];

    desiredLinks.forEach((clientNames, agentName) => {
      const agentId = agentIdByName.get(agentName);

      if (agentId) {
        const desiredClientIds = new Set(clientNames.map((n) => clientByName.get(n)?.client_id));
        clients.forEach((client) => {
          if (client.agent_id === agentId && !desiredClientIds.has(client.client_id)) {
            dropped.push({ client, agentName });
          }
        });
      }

      clientNames.forEach((clientName) => {
        const client = clientByName.get(clientName);
        if (!client || (agentId && client.agent_id === agentId)) return;
        // Linking a client that is linked elsewhere moves it; no unlink needed.
        // agentId is resolved after creation for agents created in this import.
        links.push({ client, agentId: agentId as string, agentName });
      });
    });

    // A client dropped by one agent but linked to another is a move, not a removal
    const moving = new Set(links.map(({ client }) => client.client_id));
    const removals = dropped.filter(({ client }) => !moving.has(client.client_id));

    // Like the clients handler, never modify the client the Deploy CLI authenticates with
    const skippedDeployClient = [...links, ...removals]
      .filter(({ client }) => this.isDeployClient(client))
      .map(({ client }) => client.name);
    return {
      links: links.filter(({ client }) => !this.isDeployClient(client)),
      removals: removals.filter(({ client }) => !this.isDeployClient(client)),
      skippedDeployClient: [...new Set(skippedDeployClient)],
    };
  }

  private reportSkippedDeployClient(names: string[]): void {
    if (names.length === 0) return;
    log.warn(
      `Skipping agent link changes for client(s) ${quoteList(
        names
      )}: the Deploy CLI uses this client to access the Management API, so it is never modified.`
    );
  }

  // Removing a client from an agent is destructive, like organizations' client associations
  private reportRemovals(removals: ClientLinkPlan['removals'], allowDelete: boolean): void {
    if (removals.length === 0 || allowDelete) return;
    log.warn(
      `Detected the following agent client links should be removed. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${removals
        .map(({ client, agentName }) => `"${client.name}" from agent "${agentName}"`)
        .join('\n')}`
    );
  }

  private async syncClientLinks(desiredLinks: Map<string, string[]>): Promise<void> {
    // Re-list agents to pick up IDs of agents created in this run
    const agentIdByName = new Map((await this.listAgents()).map((a) => [a.name, a.agent_id]));
    const allowDelete = this.isDeleteAllowed();
    const { links, removals, skippedDeployClient } = this.planClientLinks(
      desiredLinks,
      agentIdByName,
      this.tenantClients || []
    );
    this.reportRemovals(removals, allowDelete);
    this.reportSkippedDeployClient(skippedDeployClient);

    const retryConfig = this.getRetryConfig();

    await this.client.pool
      .addEachTask({
        data: allowDelete ? removals : [],
        generator: ({ client, agentName }) =>
          retryWithExponentialBackoff(() => this.setClientAgent(client, null), retryConfig)
            .then(() => {
              log.info(`Unlinked client "${client.name}" from agent "${agentName}"`);
              delete client.agent_id;
            })
            .catch((err) => {
              throw new Error(
                `Problem unlinking client "${client.name}" from agent "${agentName}". Re-run the import to retry.\n${err}`
              );
            }),
      })
      .promise();

    await this.client.pool
      .addEachTask({
        data: links.filter(({ agentId }) => !!agentId),
        generator: ({ client, agentId, agentName }) =>
          retryWithExponentialBackoff(() => this.setClientAgent(client, agentId), retryConfig)
            .then(() => {
              log.info(`Linked client "${client.name}" to agent "${agentName}"`);
              client.agent_id = agentId;
            })
            .catch((err) => {
              throw new Error(
                `Problem linking client "${client.name}" to agent "${agentName}". Re-run the import to retry.\n${err}`
              );
            }),
      })
      .promise();
  }

  // Agents are matched by name; a name shared by several tenant agents can't be resolved
  private assertNamesUnambiguous(agents: Asset[], existing: Agent[]): void {
    const duplicateNames = new Set(findDuplicateNames(existing));
    const ambiguous = agents.map((a) => a.name).filter((name) => duplicateNames.has(name));
    if (ambiguous.length > 0) {
      throw new ValidationError(
        `Cannot match agent(s) ${quoteList(
          ambiguous
        )}: several agents on the tenant have this name. Rename them on the tenant so each name is unique.`
      );
    }
  }

  // external_agent_id is immutable after creation; fail rather than silently ignore a change
  private assertExternalAgentIdsUnchanged(agents: Asset[], existing: Agent[]): void {
    agents.forEach((agent) => {
      if (agent.external_agent_id === undefined) return;
      const remote = existing.find((a) => a.name === agent.name);
      if (remote && remote.external_agent_id !== agent.external_agent_id) {
        throw new ValidationError(
          `Cannot change external_agent_id of agent "${agent.name}" from "${
            remote.external_agent_id ?? ''
          }" to "${
            agent.external_agent_id
          }": it can only be set when the agent is created. Restore the original value or remove the field.`
        );
      }
    });
  }

  // Configured client names must match exactly one managed client
  private assertClientsExist(
    agents: Asset[],
    tenantClients: ClientWithAgent[],
    clientsCreatedByImport: string[] = []
  ): void {
    const known = new Set([...tenantClients.map((c) => c.name), ...clientsCreatedByImport]);
    const duplicateClientNames = new Set(findDuplicateNames(tenantClients));
    agents.forEach((agent) => {
      const clientNames: string[] = agent.clients || [];
      const missing = clientNames.filter((name) => !known.has(name));
      if (missing.length > 0) {
        throw new ValidationError(
          `Agent "${agent.name}" links to client(s) that do not exist or are excluded: ${quoteList(
            missing
          )}.`
        );
      }
      const ambiguous = clientNames.filter((name) => duplicateClientNames.has(name));
      if (ambiguous.length > 0) {
        throw new ValidationError(
          `Agent "${
            agent.name
          }" links to client(s) shared by several clients on the tenant: ${quoteList(
            ambiguous
          )}. Rename them on the tenant so each name is unique.`
        );
      }
    });
  }
}
