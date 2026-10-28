import { Management } from 'auth0';
import ValidationError from '../../validationError';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import DefaultAPIHandler, { order, retryWithExponentialBackoff } from './default';
import { paginate } from '../client';
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
          'Names of the clients linked to this agent. Omit to leave links untouched; use [] to unlink all.',
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

// node-auth0 does not type `agent_id` on clients yet; the API returns it and the SDK passes it through.
type ClientWithAgent = Management.Client & {
  client_id: string;
  name: string;
  agent_id?: string | null;
};

export default class AgentsHandler extends DefaultAPIHandler {
  existing: Agent[] | null;

  private agentsNotEnabled = false;

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
    if (this.existing || this.agentsNotEnabled) return this.existing;

    let agents: Management.AgentResponseContent[];
    try {
      agents = await this.listAgents();
    } catch (err) {
      if (err.statusCode === 403 && err.message?.includes('Insufficient scope')) throw err;
      if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 501) {
        log.debug(
          'Agents are not enabled for this tenant. Contact Auth0 support to enable the agents_as_principals_limited_ea feature.'
        );
        this.agentsNotEnabled = true;
        return null;
      }
      throw err;
    }

    // Agent names are not unique on the tenant, but agents are matched by name
    const duplicateNames = findDuplicateNames(agents);
    if (duplicateNames.length > 0) {
      log.warn(
        `Multiple agents share the name(s) ${duplicateNames
          .map((n) => `"${n}"`)
          .join(
            ', '
          )}. Agents are matched by name, so rename them to manage them from configuration.`
      );
    }

    // Represent client links by client name so they are portable across tenants
    const clients = await this.listClients();
    this.existing = agents.map((agent) => ({
      ...agent,
      clients: clients.filter((c) => c.agent_id === agent.agent_id).map((c) => c.name),
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

    const existing = await this.getType();
    this.assertAgentsEnabled(existing);
    this.assertNamesUnambiguous(agents, existing);
    this.assertExternalAgentIdsUnchanged(agents, existing);

    // Clients created earlier in the same import do not exist on the tenant yet
    const clients = await this.listClients();
    const knownClientNames = [
      ...clients.map((c) => c.name),
      ...(assets.clients || []).map((c) => c.name as string),
    ];
    this.assertClientsExist(agents, knownClientNames);

    const changes = await super.dryRunChanges(assets);

    const allowDelete =
      this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true;
    if (allowDelete) {
      changes.del.forEach((agent) => {
        const linked = clients.filter((c) => c.agent_id === agent.agent_id).map((c) => c.name);
        if (linked.length > 0) {
          log.warn(
            `Deleting agent "${agent.name}" will first unlink client(s) ${linked
              .map((n) => `"${n}"`)
              .join(', ')}. The clients are kept.`
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

    const existing = await this.getType();
    this.assertAgentsEnabled(existing);
    this.assertNamesUnambiguous(agents, existing);
    this.assertExternalAgentIdsUnchanged(agents, existing);

    // Snapshot desired links before the default flow strips `clients` from payloads
    const desiredLinks = new Map<string, string[]>(
      agents
        .filter((agent) => Array.isArray(agent.clients))
        .map((agent) => [agent.name, [...agent.clients]])
    );

    // Re-fetch so clients created earlier in this import can be linked
    this.tenantClients = await this.listClients();
    this.assertClientsExist(
      agents,
      this.tenantClients.map((c) => c.name)
    );

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    await super.processChanges(assets, { del, update, create, conflicts });

    if (desiredLinks.size > 0) {
      await this.syncClientLinks(desiredLinks);
    }
  }

  private async listAgents(): Promise<Management.AgentResponseContent[]> {
    return paginate<Management.AgentResponseContent>(this.client.agents.list, {
      checkpoint: true,
      take: 100,
    });
  }

  private async listClients(): Promise<ClientWithAgent[]> {
    return paginate<ClientWithAgent>(this.client.clients.list, {
      paginate: true,
      is_global: false,
    });
  }

  private setClientAgent(client: ClientWithAgent, agentId: string | null) {
    return this.client.clients.update(
      client.client_id,
      {},
      { additionalBodyParameters: { agent_id: agentId } }
    );
  }

  // DELETE /agents/{id} keeps linked clients but leaves their agent_id pointing at
  // the deleted agent. Unlink them first so no client references a missing agent.
  private async deleteAgent(agentId: string): Promise<void> {
    const clients = this.tenantClients || (await this.listClients());
    const linked = clients.filter((c) => c.agent_id === agentId);

    for (const client of linked) {
      await this.setClientAgent(client, null);
      client.agent_id = null;
      log.info(`Unlinked client "${client.name}" from deleted agent [${agentId}]`);
    }

    await this.client.agents.delete(agentId);
  }

  private async syncClientLinks(desiredLinks: Map<string, string[]>): Promise<void> {
    // Re-list agents to pick up IDs of agents created in this run
    const agentIdByName = new Map((await this.listAgents()).map((a) => [a.name, a.agent_id]));
    const clientByName = new Map((this.tenantClients || []).map((c) => [c.name, c]));

    const unlinks = new Map<string, ClientWithAgent>();
    const links: { client: ClientWithAgent; agentId: string; agentName: string }[] = [];

    desiredLinks.forEach((clientNames, agentName) => {
      const agentId = agentIdByName.get(agentName);
      if (!agentId) return;

      const desiredClientIds = new Set(clientNames.map((n) => clientByName.get(n)?.client_id));

      (this.tenantClients || []).forEach((client) => {
        if (client.agent_id === agentId && !desiredClientIds.has(client.client_id)) {
          unlinks.set(client.client_id, client);
        }
      });

      clientNames.forEach((clientName) => {
        const client = clientByName.get(clientName);
        if (!client || client.agent_id === agentId) return;
        // Linking a client that is linked elsewhere moves it; no unlink needed
        links.push({ client, agentId, agentName });
      });
    });

    const retryConfig = this.getRetryConfig();

    await this.client.pool
      .addEachTask({
        data: [...unlinks.values()],
        generator: (client: ClientWithAgent) =>
          retryWithExponentialBackoff(() => this.setClientAgent(client, null), retryConfig)
            .then(() => {
              log.info(`Unlinked client "${client.name}" from agent [${client.agent_id}]`);
              client.agent_id = null;
            })
            .catch((err) => {
              throw new Error(`Problem unlinking client "${client.name}" from its agent\n${err}`);
            }),
      })
      .promise();

    await this.client.pool
      .addEachTask({
        data: links,
        generator: ({ client, agentId, agentName }) =>
          retryWithExponentialBackoff(() => this.setClientAgent(client, agentId), retryConfig)
            .then(() => {
              log.info(`Linked client "${client.name}" to agent "${agentName}"`);
              client.agent_id = agentId;
            })
            .catch((err) => {
              throw new Error(
                `Problem linking client "${client.name}" to agent "${agentName}"\n${err}`
              );
            }),
      })
      .promise();
  }

  private assertAgentsEnabled(existing: Agent[] | null): asserts existing is Agent[] {
    if (existing === null) {
      throw new Error(
        'Agents are configured but are not enabled for this tenant. Contact Auth0 support to enable the agents_as_principals_limited_ea feature.'
      );
    }
  }

  // Agents are matched by name; a name shared by several tenant agents can't be resolved
  private assertNamesUnambiguous(agents: Asset[], existing: Agent[]): void {
    const duplicateNames = new Set(findDuplicateNames(existing));
    const ambiguous = agents.map((a) => a.name).filter((name) => duplicateNames.has(name));
    if (ambiguous.length > 0) {
      throw new ValidationError(
        `Cannot match agent(s) ${ambiguous
          .map((n) => `"${n}"`)
          .join(
            ', '
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

  private assertClientsExist(agents: Asset[], knownClientNames: string[]): void {
    const known = new Set(knownClientNames);
    agents.forEach((agent) => {
      const missing = (agent.clients || []).filter((name: string) => !known.has(name));
      if (missing.length > 0) {
        throw new ValidationError(
          `Agent "${agent.name}" links to client(s) that do not exist: ${missing
            .map((n: string) => `"${n}"`)
            .join(', ')}.`
        );
      }
    });
  }
}
