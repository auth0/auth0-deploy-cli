import { omit, isEqual, pick } from 'lodash';
import { Management } from 'auth0';
import DefaultHandler, { order, retryWithExponentialBackoff } from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { convertClientIdToName } from '../../../utils';
import { isDryRun } from '../../utils';
import { Client } from './clients';
import { Connection } from './connections';
import { ClientGrant } from './clientGrants';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      display_name: { type: 'string' },
      branding: { type: 'object' },
      metadata: { type: 'object' },
      connections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            connection_id: { type: 'string' },
            organization_connection_name: { type: 'string' },
            assign_membership_on_login: { type: 'boolean' },
            show_as_button: { type: 'boolean' },
            is_signup_enabled: { type: 'boolean' },
            organization_access_level: {
              type: 'string',
              enum: Object.values(Management.OrganizationAccessLevelEnum),
            },
            is_enabled: { type: 'boolean' },
          },
        },
      },
      client_grants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
          },
        },
        default: [],
      },
      token_quota: {
        type: ['object', 'null'],
        properties: {
          client_credentials: {
            type: 'object',
            properties: {
              enforce: {
                type: 'boolean',
                default: true,
              },
              per_day: {
                type: 'integer',
                minimum: 1,
              },
              per_hour: {
                type: 'integer',
                minimum: 1,
              },
            },
            additionalProperties: false,
            minProperties: 1,
          },
        },
        required: ['client_credentials'],
      },
      discovery_domains: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'verified'] },
            use_for_organization_discovery: {
              type: 'boolean',
            },
          },
          required: ['domain', 'status'],
        },
      },
      third_party_client_access: {
        type: 'string',
        enum: Object.values(Management.OrganizationThirdPartyClientAccessEnum),
      },
      is_app_entitlement_active: { type: 'boolean' },
      clients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            use_for_member_access: { type: 'boolean' },
          },
          required: ['client_id', 'use_for_member_access'],
        },
        default: [],
      },
    },
    required: ['name'],
  },
};

type Organization = Management.Organization;

type FormattedClientGrants = {
  // eslint-disable-next-line camelcase
  grant_id: string | undefined;
  // eslint-disable-next-line camelcase
  client_id: string | undefined;
};

type OrgClientAssociation = {
  client_id: string | undefined;
  use_for_member_access: boolean | undefined;
};

export default class OrganizationsHandler extends DefaultHandler {
  existing: Asset[];

  formattedClientGrants: FormattedClientGrants[];

  allClients: Client[];

  constructor(config: DefaultHandler) {
    super({
      ...config,
      type: 'organizations',
      id: 'id',
    });
  }

  async deleteOrganization(org): Promise<void> {
    await this.client.organizations.delete(org.id);
  }

  async deleteOrganizations(data: Asset[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item) =>
            this.deleteOrganization(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following organizations should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }

  async createOrganization(org): Promise<Asset> {
    const organization = { ...org };
    delete organization.connections;
    delete organization.client_grants;
    delete organization.clients;

    if ('discovery_domains' in organization) {
      delete organization.discovery_domains;
    }

    const created = await this.client.organizations.create(organization);

    if (!created.id) {
      throw new Error(
        `Organization "${organization.name}" was created but the response did not include an ID. Skipping connection/grant association.`
      );
    }

    const createdId = created.id;

    const retryConfig = this.getRetryConfig();

    if (typeof org.connections !== 'undefined' && org.connections.length > 0) {
      await Promise.all(
        org.connections.map((conn) =>
          retryWithExponentialBackoff(
            () =>
              this.client.organizations.connections.create(
                createdId,
                conn as Management.CreateOrganizationAllConnectionRequestParameters
              ),
            retryConfig
          )
        )
      );
    }

    if (typeof org.client_grants !== 'undefined' && org.client_grants.length > 0) {
      await Promise.all(
        org.client_grants.map((organizationClientGrants) =>
          this.createOrganizationClientGrants(
            createdId,
            this.getClientGrantIDByClientName(organizationClientGrants.client_id as string)
          )
        )
      );
    }

    if (typeof org.discovery_domains !== 'undefined' && org.discovery_domains.length > 0) {
      await Promise.all(
        org.discovery_domains.map(
          (discoveryDomain: Management.CreateOrganizationDiscoveryDomainRequestContent) =>
            this.createOrganizationDiscoveryDomain(createdId, {
              domain: discoveryDomain?.domain,
              status: discoveryDomain?.status,
              use_for_organization_discovery: discoveryDomain?.use_for_organization_discovery,
            }).catch((err) => {
              throw new Error(
                `Problem creating discovery domain ${discoveryDomain?.domain} for organization ${createdId}\n${err}`
              );
            })
        )
      );
    }

    if (typeof org.clients !== 'undefined' && org.clients.length > 0) {
      const clientsToCreate = (org.clients as OrgClientAssociation[])
        .map((oc) => ({
          client_id: this.getClientIdByClientName(oc.client_id as string),
          use_for_member_access: oc.use_for_member_access as boolean,
        }))
        .filter((oc) => !!oc.client_id);

      if (clientsToCreate.length > 0) {
        await this.createOrganizationClients(createdId, clientsToCreate).catch((err) => {
          throw new Error(`Problem creating org clients for organization ${createdId}\n${err}`);
        });
      }
    }

    return created;
  }

  async createOrganizations(creates: CalculatedChanges['create']) {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item) =>
          this.createOrganization(item)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updateOrganization(org, organizations) {
    const existingOrg = organizations.find((orgToUpdate) => orgToUpdate.name === org.name);
    const {
      connections: existingConnections,
      client_grants: existingClientGrants,
      discovery_domains: existingDiscoveryDomains,
      clients: existingOrgClients = [],
    } = existingOrg;

    const params = { id: org.id };
    const {
      connections,
      client_grants: organizationClientGrants,
      discovery_domains: organizationDiscoveryDomains,
      clients: organizationClients,
    } = org;

    delete org.connections;
    delete org.name;
    delete org.id;
    delete org.client_grants;
    delete org.discovery_domains;
    delete org.clients;

    // Only PATCH if top-level properties actually differ from the existing state.
    // Compare only the keys present in the desired config against those same keys
    // on the remote org, so that fields the user didn't specify are not considered.
    let changed = false;
    if (!isEqual(org, pick(existingOrg, Object.keys(org)))) {
      await this.client.organizations.update(params.id, org);
      changed = true;
    }

    // organization connections
    const connectionsToRemove = existingConnections.filter(
      (c) => !connections.find((x) => x.connection_id === c.connection_id)
    );
    const connectionsToAdd = connections.filter(
      (c) => !existingConnections.find((x) => x.connection_id === c.connection_id)
    );
    const connectionsToUpdate = connections.filter((c) =>
      existingConnections.find(
        (x) =>
          x.connection_id === c.connection_id &&
          (x.assign_membership_on_login !== c.assign_membership_on_login ||
            x.show_as_button !== c.show_as_button ||
            x.is_signup_enabled !== c.is_signup_enabled ||
            x.organization_access_level !== c.organization_access_level ||
            x.organization_connection_name !== c.organization_connection_name ||
            x.is_enabled !== (c.is_enabled ?? true))
      )
    );

    if (
      connectionsToUpdate.length > 0 ||
      connectionsToAdd.length > 0 ||
      connectionsToRemove.length > 0
    ) {
      changed = true;
    }

    const retryConfig = this.getRetryConfig();

    // Handle updates first
    await Promise.all(
      connectionsToUpdate.map((conn: Management.CreateOrganizationAllConnectionRequestParameters) =>
        retryWithExponentialBackoff(
          () =>
            this.client.organizations.connections.update(params.id, conn.connection_id, {
              organization_connection_name: conn.organization_connection_name,
              assign_membership_on_login: conn.assign_membership_on_login,
              show_as_button: conn.show_as_button,
              is_signup_enabled: conn.is_signup_enabled,
              is_enabled: conn.is_enabled,
              organization_access_level: conn.organization_access_level,
            }),
          retryConfig
        ).catch(() => {
          throw new Error(
            `Problem updating Enabled Connection ${conn.connection_id} for organizations ${params.id}`
          );
        })
      )
    );

    await Promise.all(
      connectionsToAdd.map((conn: Management.CreateOrganizationAllConnectionRequestParameters) =>
        retryWithExponentialBackoff(
          () =>
            this.client.organizations.connections.create(
              params.id,
              omit<Management.OrganizationConnection>(
                conn,
                'connection'
              ) as Management.AddOrganizationConnectionRequestContent
            ),
          retryConfig
        ).catch(() => {
          throw new Error(
            `Problem adding Enabled Connection ${conn.connection_id} for organizations ${params.id}`
          );
        })
      )
    );

    await Promise.all(
      connectionsToRemove.map((conn: Management.OrganizationConnection) =>
        retryWithExponentialBackoff(
          () =>
            this.client.organizations.connections.delete(params.id, conn.connection_id as string),
          retryConfig
        ).catch(() => {
          throw new Error(
            `Problem removing Enabled Connection ${conn.connection_id} for organizations ${params.id}`
          );
        })
      )
    );

    // organization client_grants
    const orgClientGrantsToRemove =
      existingClientGrants
        ?.filter((c) => !organizationClientGrants?.find((x) => x.client_id === c.client_id))
        ?.map((clientGrant) => ({
          grant_id: this.getClientGrantIDByClientName(clientGrant.client_id),
        })) || [];

    const orgClientGrantsToAdd =
      organizationClientGrants
        ?.filter((c) => !existingClientGrants?.find((x) => x.client_id === c.client_id))
        ?.map((clientGrant) => ({
          grant_id: this.getClientGrantIDByClientName(clientGrant.client_id),
        })) || [];

    if (orgClientGrantsToAdd.length > 0 || orgClientGrantsToRemove.length > 0) {
      changed = true;
    }

    // Handle updates first
    await Promise.all(
      orgClientGrantsToAdd.map((orgClientGrant) =>
        this.createOrganizationClientGrants(params.id, orgClientGrant.grant_id).catch(() => {
          throw new Error(
            `Problem adding organization clientGrant ${orgClientGrant.grant_id} for organizations ${params.id}`
          );
        })
      )
    );

    await Promise.all(
      orgClientGrantsToRemove.map((orgClientGrant) =>
        this.deleteOrganizationClientGrants(params.id, orgClientGrant.grant_id).catch(() => {
          throw new Error(
            `Problem removing organization clientGrant ${orgClientGrant.grant_id} for organizations ${params.id}`
          );
        })
      )
    );

    // organization discovery_domains
    const orgDiscoveryDomainsToRemove =
      existingDiscoveryDomains?.filter(
        (existingDomain) =>
          !organizationDiscoveryDomains?.find((d) => d.domain === existingDomain.domain)
      ) || [];

    const orgDiscoveryDomainsToAdd =
      organizationDiscoveryDomains?.filter(
        (domain) => !existingDiscoveryDomains?.find((d) => d.domain === domain.domain)
      ) || [];

    const orgDiscoveryDomainsToUpdate =
      existingDiscoveryDomains
        ?.map((existingDomain) => {
          const updatedDomain = organizationDiscoveryDomains?.find(
            (d) => d.domain === existingDomain.domain
          );
          if (!updatedDomain) return undefined;

          return {
            ...updatedDomain,
            id: existingDomain.id, // setting remote id for update
          };
        })
        .filter(Boolean) || [];

    if (orgDiscoveryDomainsToUpdate.length > 0 || orgDiscoveryDomainsToAdd.length > 0) {
      changed = true;
    }

    for (const { id, domain, ...updateParams } of orgDiscoveryDomainsToUpdate) {
      try {
        await this.updateOrganizationDiscoveryDomain(params.id, id, domain, updateParams);
      } catch (err) {
        throw new Error(
          `Problem updating discovery domain ${domain} for organization ${params.id}\n${err.message}`
        );
      }
    }

    for (const domain of orgDiscoveryDomainsToAdd) {
      try {
        await this.createOrganizationDiscoveryDomain(params.id, {
          domain: domain.domain,
          status: domain.status,
          use_for_organization_discovery: domain.use_for_organization_discovery,
        });
      } catch (err) {
        throw new Error(
          `Problem adding discovery domain ${domain.domain} for organization ${params.id}\n${err.message}`
        );
      }
    }

    if (orgDiscoveryDomainsToRemove.length > 0) {
      if (
        this.config('AUTH0_ALLOW_DELETE') === 'true' ||
        this.config('AUTH0_ALLOW_DELETE') === true
      ) {
        changed = true;
        for (const domain of orgDiscoveryDomainsToRemove) {
          try {
            await this.deleteOrganizationDiscoveryDomain(params.id, domain.domain, domain.id);
          } catch (err) {
            throw new Error(
              `Problem removing discovery domain ${domain.domain} for organization ${params.id}\n${err.message}`
            );
          }
        }
      } else {
        log.warn(`Detected the following organization discovery domains should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${orgDiscoveryDomainsToRemove.map((i) => this.objString(i)).join('\n')}`);
      }
    }

    // organization clients
    const orgClientsToAdd = ((organizationClients as OrgClientAssociation[]) || [])
      .filter(
        (c) =>
          !(existingOrgClients as OrgClientAssociation[]).find((x) => x.client_id === c.client_id)
      )
      .map((oc) => ({
        client_id: this.getClientIdByClientName(oc.client_id as string),
        use_for_member_access: oc.use_for_member_access as boolean,
      }))
      .filter((oc) => !!oc.client_id);

    const orgClientsToRemove = ((existingOrgClients as OrgClientAssociation[]) || [])
      .filter(
        (c) =>
          !((organizationClients as OrgClientAssociation[]) || []).find(
            (x) => x.client_id === c.client_id
          )
      )
      .map((oc) => this.getClientIdByClientName(oc.client_id as string))
      .filter(Boolean);

    const orgClientsToUpdate = ((organizationClients as OrgClientAssociation[]) || [])
      .filter((c) => {
        const existing = (existingOrgClients as OrgClientAssociation[]).find(
          (x) => x.client_id === c.client_id
        );
        return existing && existing.use_for_member_access !== c.use_for_member_access;
      })
      .map((oc) => ({
        client_id: this.getClientIdByClientName(oc.client_id as string),
        use_for_member_access: oc.use_for_member_access as boolean,
      }))
      .filter((oc) => !!oc.client_id);

    if (orgClientsToAdd.length > 0) {
      changed = true;
      await this.createOrganizationClients(params.id, orgClientsToAdd).catch((err) => {
        throw new Error(`Problem adding org clients for organization ${params.id}\n${err}`);
      });
    }

    if (orgClientsToRemove.length > 0) {
      if (
        this.config('AUTH0_ALLOW_DELETE') === 'true' ||
        this.config('AUTH0_ALLOW_DELETE') === true
      ) {
        changed = true;
        await this.deleteOrganizationClients(params.id, orgClientsToRemove).catch((err) => {
          throw new Error(`Problem removing org clients for organization ${params.id}\n${err}`);
        });
      } else {
        log.warn(
          `Detected the following organization client associations should be removed. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${orgClientsToRemove.join(
            '\n'
          )}`
        );
      }
    }

    if (orgClientsToUpdate.length > 0) {
      changed = true;
    }
    await Promise.all(
      orgClientsToUpdate.map((oc) =>
        this.client.organizations.clients
          .update(params.id, oc.client_id, {
            use_for_member_access: oc.use_for_member_access,
          })
          .catch((err) => {
            throw new Error(
              `Problem updating org client ${oc.client_id} for organization ${params.id}\n${err}`
            );
          })
      )
    );

    return changed ? params : null;
  }

  getClientGrantIDByClientName(clientsName: string): string {
    const found = this.formattedClientGrants.find((c) => c.client_id === clientsName);
    return found?.grant_id || '';
  }

  getClientIdByClientName(clientName: string): string {
    const found = this.allClients?.find((c) => c.name === clientName);
    return found?.client_id || '';
  }

  async getFormattedClientGrants(): Promise<FormattedClientGrants[]> {
    const [clients, clientGrants] = await Promise.all([
      paginate<Client>(this.client.clients.list, {
        paginate: true,
      }),
      paginate<ClientGrant>(this.client.clientGrants.list, {
        paginate: true,
      }),
    ]);

    // Store clients for org-client name→ID resolution
    this.allClients = clients;

    // Convert clients by name to the id and store it in the formattedClientGrants
    const formattedClientGrantsMapping = clientGrants?.map((clientGrant) => {
      const { id, client_id: clientName } = clientGrant;
      const grant = { grant_id: id, client_id: clientName };
      const found = clients.find((c) => c.client_id === grant.client_id);
      if (found) grant.client_id = found.name;
      return grant;
    });

    return formattedClientGrantsMapping;
  }

  async updateOrganizations(updates: CalculatedChanges['update'], orgs: Asset[]): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item) =>
          this.updateOrganization(item, orgs)
            .then((data) => {
              if (data) {
                this.didUpdate(data);
                this.updated += 1;
              }
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) {
      return this.existing;
    }

    try {
      const [organizations, clients] = await Promise.all([
        paginate<Organization>(this.client.organizations.list, {
          checkpoint: true,
        }),
        paginate<Client>(this.client.clients.list, {
          paginate: true,
        }),
      ]);

      for (let index = 0; index < organizations.length; index++) {
        const org = organizations[index];
        if (!org?.id) {
          throw new Error(`Organization ${index} is missing an ID`);
        }

        const connections = await this.getOrganizationConnections(org.id);

        org.connections = connections;

        const organizationClientGrants = await this.getOrganizationClientGrants(org.id);

        org.client_grants = organizationClientGrants?.map((clientGrant) => ({
          client_id: convertClientIdToName(clientGrant.client_id as string, clients),
        }));

        // Get discovery domains for each organization
        const organizationDiscoveryDomains = await this.getAllOrganizationDiscoveryDomains(org.id);
        if (organizationDiscoveryDomains) {
          org.discovery_domains = organizationDiscoveryDomains;
        }

        // Get org-client associations
        const orgClients = await this.getAllOrganizationClients(org.id);
        if (orgClients) {
          org.clients = orgClients.map((oc) => ({
            client_id: convertClientIdToName(oc.client_id, clients),
            use_for_member_access: oc.use_for_member_access,
          }));
        }
      }

      this.existing = organizations;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return [];
      }
      throw err;
    }
  }

  // Run after connections
  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { organizations } = assets;
    // Do nothing if not set
    if (!organizations) return;

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }
    // Gets organizations from destination tenant
    const existing = await this.getType();

    const existingConnections = await paginate<Connection>(this.client.connections.list, {
      checkpoint: true,
    });

    // We need to get the connection ids for the names configured so we can link them together
    organizations.forEach((org) => {
      org.connections = (org.connections || [])
        .map((connection) => {
          const { name } = connection;
          delete connection.name;

          return {
            ...connection,
            connection_id: (existingConnections.find((c) => c.name === name) || {}).id,
          };
        })
        .filter((connection) => !!connection.connection_id);
    });

    // store formated client_grants->client_id to client grant->grant_id mapping
    this.formattedClientGrants = await this.getFormattedClientGrants();

    const changes = calculateChanges({
      handler: this,
      assets: organizations,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });

    log.debug(
      `Start processChanges for organizations [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`
    );

    if (changes.del.length > 0) {
      await this.deleteOrganizations(changes.del);
    }

    if (changes.create.length > 0) {
      await this.createOrganizations(changes.create);
    }

    if (changes.update.length > 0) {
      await this.updateOrganizations(changes.update, existing);
    }
  }

  async getOrganizationConnections(
    organizationId: string
  ): Promise<Management.OrganizationConnection[]> {
    const allOrganizationConnections: Management.OrganizationConnection[] = [];

    let organizationConnections = await this.client.organizations.connections.list(organizationId);

    // Process first page
    allOrganizationConnections.push(...organizationConnections.data);

    // Fetch remaining pages
    while (organizationConnections.hasNextPage()) {
      organizationConnections = await organizationConnections.getNextPage();
      allOrganizationConnections.push(...organizationConnections.data);
    }

    return allOrganizationConnections;
  }

  async getOrganizationClientGrants(
    organizationId: string
  ): Promise<Management.OrganizationClientGrant[]> {
    const allOrganizationClientGrants: Management.OrganizationClientGrant[] = [];

    let organizationClientGrants = await this.client.organizations.clientGrants.list(
      organizationId
    );

    // Process first page
    allOrganizationClientGrants.push(...organizationClientGrants.data);

    // Fetch remaining pages
    while (organizationClientGrants.hasNextPage()) {
      organizationClientGrants = await organizationClientGrants.getNextPage();
      allOrganizationClientGrants.push(...organizationClientGrants.data);
    }

    return allOrganizationClientGrants;
  }

  async createOrganizationClientGrants(
    organizationId: string,
    grantId: string
  ): Promise<Management.AssociateOrganizationClientGrantResponseContent> {
    log.debug(`Creating organization client grant ${grantId} for organization ${organizationId}`);
    const organizationClientGrants = await this.client.organizations.clientGrants.create(
      organizationId,
      {
        grant_id: grantId,
      }
    );

    return organizationClientGrants;
  }

  async deleteOrganizationClientGrants(organizationId: string, grantId: string): Promise<void> {
    log.debug(`Deleting organization client grant ${grantId} for organization ${organizationId}`);
    await this.client.organizations.clientGrants.delete(organizationId, grantId);
  }

  async getAllOrganizationDiscoveryDomains(
    organizationId: string
  ): Promise<Management.OrganizationDiscoveryDomain[] | null> {
    // paginate using checkpoint pagination for getAllDiscoveryDomains
    const allDiscoveryDomains: Management.OrganizationDiscoveryDomain[] = [];

    try {
      let orgDiscoveryDomain = await this.client.organizations.discoveryDomains.list(
        organizationId
      );

      // Process first page
      allDiscoveryDomains.push(...orgDiscoveryDomain.data);

      // Fetch remaining pages
      while (orgDiscoveryDomain.hasNextPage()) {
        orgDiscoveryDomain = await orgDiscoveryDomain.getNextPage();
        allDiscoveryDomains.push(...orgDiscoveryDomain.data);
      }

      return allDiscoveryDomains;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (err.statusCode === 403 || err.errorCode === 'feature_not_enabled') {
        log.debug(
          'Organization Discovery domains are not enabled for this tenant. Please verify `scope` or contact Auth0 support to enable this feature.'
        );
        return null;
      }
      throw err;
    }
  }

  async getOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomainId: string
  ): Promise<Management.GetOrganizationDiscoveryDomainResponseContent> {
    const orgDiscoveryDomain = await this.client.organizations.discoveryDomains.get(
      organizationId,
      discoveryDomainId
    );
    return orgDiscoveryDomain;
  }

  async createOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomain: Management.CreateOrganizationDiscoveryDomainRequestContent
  ): Promise<Management.CreateOrganizationDiscoveryDomainResponseContent> {
    log.debug(
      `Creating discovery domain ${discoveryDomain.domain} for organization ${organizationId}`
    );
    const orgDiscoveryDomain = await this.client.organizations.discoveryDomains.create(
      organizationId,
      discoveryDomain
    );
    return orgDiscoveryDomain;
  }

  async updateOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomainId: string,
    discoveryDomain: string,
    discoveryDomainUpdate: Management.UpdateOrganizationDiscoveryDomainRequestContent
  ): Promise<Management.UpdateOrganizationDiscoveryDomainResponseContent> {
    log.debug(`Updating discovery domain ${discoveryDomain} for organization ${organizationId}`);

    // stripUpdateFields does not support in sub modules
    const stripUpdateFields = ['verification_host', 'verification_txt'];
    log.debug(
      `Stripping ${this.type} discovery domain read-only fields ${JSON.stringify(
        stripUpdateFields
      )}`
    );

    const discoveryDomainUpdated = await this.client.organizations.discoveryDomains.update(
      organizationId,
      discoveryDomainId,
      {
        status: discoveryDomainUpdate.status,
        use_for_organization_discovery: discoveryDomainUpdate.use_for_organization_discovery,
      }
    );
    return discoveryDomainUpdated;
  }

  async deleteOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomain: string,
    discoveryDomainId: string
  ): Promise<void> {
    log.debug(`Deleting discovery domain ${discoveryDomain} for organization ${organizationId}`);
    await this.client.organizations.discoveryDomains.delete(organizationId, discoveryDomainId);
  }

  async getAllOrganizationClients(
    organizationId: string
  ): Promise<Management.OrganizationClient[] | null> {
    const allOrgClients: Management.OrganizationClient[] = [];

    try {
      let orgClients = await this.client.organizations.clients.list(organizationId);

      allOrgClients.push(...orgClients.data);

      while (orgClients.hasNextPage()) {
        orgClients = await orgClients.getNextPage();
        allOrgClients.push(...orgClients.data);
      }

      return allOrgClients;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (err.statusCode === 403 || err.errorCode === 'feature_not_enabled') {
        log.debug(
          'Org-to-app entitlement is not enabled for this tenant. Skipping org-client associations.'
        );
        return null;
      }
      throw err;
    }
  }

  async createOrganizationClients(
    organizationId: string,
    clients: Array<{ client_id: string; use_for_member_access: boolean }>
  ): Promise<void> {
    const BATCH_SIZE = 10;
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      log.debug(`Creating ${batch.length} org client(s) for organization ${organizationId}`);
      await this.client.organizations.clients.create(organizationId, { clients: batch });
    }
  }

  async deleteOrganizationClients(organizationId: string, clientIds: string[]): Promise<void> {
    const BATCH_SIZE = 10;
    for (let i = 0; i < clientIds.length; i += BATCH_SIZE) {
      const batch = clientIds.slice(i, i + BATCH_SIZE);
      log.debug(`Deleting ${batch.length} org client(s) for organization ${organizationId}`);
      await this.client.organizations.clients.delete(organizationId, { clients: batch });
    }
  }
}
