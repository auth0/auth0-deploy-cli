import _, { isArray } from 'lodash';
import {
  Client,
  ClientGrant,
  Connection,
  CreateOrganizationDiscoveryDomainRequestContent,
  CreateOrganizationDiscoveryDomainResponseContent,
  GetOrganizationClientGrants200ResponseOneOfInner,
  GetOrganizationDiscoveryDomainResponseContent,
  GetOrganizations200ResponseOneOfInner,
  OrganizationDiscoveryDomain,
  OrganizationDiscoveryDomainStatus,
  PostEnabledConnectionsRequest,
  UpdateOrganizationDiscoveryDomainResponseContent,
} from 'auth0';
import DefaultHandler, { order } from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { convertClientIdToName } from '../../../utils';

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
            assign_membership_on_login: { type: 'boolean' },
            show_as_button: { type: 'boolean' },
            is_signup_enabled: { type: 'boolean' },
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
          },
          required: ['domain', 'status'],
        },
      },
    },
    required: ['name'],
  },
};

type FormattedClientGrants = {
  // eslint-disable-next-line camelcase
  grant_id: string;
  // eslint-disable-next-line camelcase
  client_id: string;
};

export default class OrganizationsHandler extends DefaultHandler {
  existing: Asset[];

  formattedClientGrants: FormattedClientGrants[];

  constructor(config: DefaultHandler) {
    super({
      ...config,
      type: 'organizations',
      id: 'id',
    });
  }

  async deleteOrganization(org): Promise<void> {
    await this.client.organizations.delete({ id: org.id });
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

    if ('discovery_domains' in organization) {
      delete organization.discovery_domains;
    }

    const { data: created } = await this.client.organizations.create(organization);

    if (typeof org.connections !== 'undefined' && org.connections.length > 0) {
      await Promise.all(
        org.connections.map((conn) =>
          this.client.organizations.addEnabledConnection({ id: created.id }, conn)
        )
      );
    }

    if (typeof org.client_grants !== 'undefined' && org.client_grants.length > 0) {
      await Promise.all(
        org.client_grants.map((organizationClientGrants) =>
          this.createOrganizationClientGrants(
            created.id,
            this.getClientGrantIDByClientName(organizationClientGrants.client_id)
          )
        )
      );
    }

    if (typeof org.discovery_domains !== 'undefined' && org.discovery_domains.length > 0) {
      await this.client.pool
        .addEachTask({
          data: org.discovery_domains,
          generator: (discoveryDomain: CreateOrganizationDiscoveryDomainRequestContent) =>
            this.createOrganizationDiscoveryDomain(created.id, {
              domain: discoveryDomain?.domain,
              status: discoveryDomain?.status,
            }).catch((err) => {
              throw new Error(
                `Problem creating discovery domain ${discoveryDomain?.domain} for organization ${created.id}\n${err}`
              );
            }),
        })
        .promise();
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
    const {
      connections: existingConnections,
      client_grants: existingClientGrants,
      discovery_domains: existingDiscoveryDomains,
    } = await organizations.find((orgToUpdate) => orgToUpdate.name === org.name);

    const params = { id: org.id };
    const {
      connections,
      client_grants: organizationClientGrants,
      discovery_domains: organizationDiscoveryDomains,
    } = org;

    delete org.connections;
    delete org.name;
    delete org.id;
    delete org.client_grants;
    delete org.discovery_domains;

    await this.client.organizations.update(params, org);

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
            x.is_signup_enabled !== c.is_signup_enabled)
      )
    );

    // Handle updates first
    await Promise.all(
      connectionsToUpdate.map((conn) =>
        this.client.organizations
          .updateEnabledConnection(
            { connectionId: conn.connection_id, ...params },
            {
              assign_membership_on_login: conn.assign_membership_on_login,
              show_as_button: conn.show_as_button,
              is_signup_enabled: conn.is_signup_enabled,
            }
          )
          .catch(() => {
            throw new Error(
              `Problem updating Enabled Connection ${conn.connection_id} for organizations ${params.id}`
            );
          })
      )
    );

    await Promise.all(
      connectionsToAdd.map((conn) =>
        this.client.organizations
          .addEnabledConnection(
            params,
            _.omit<PostEnabledConnectionsRequest>(
              conn,
              'connection'
            ) as PostEnabledConnectionsRequest
          )
          .catch(() => {
            throw new Error(
              `Problem adding Enabled Connection ${conn.connection_id} for organizations ${params.id}`
            );
          })
      )
    );

    await Promise.all(
      connectionsToRemove.map((conn) =>
        this.client.organizations
          .deleteEnabledConnection({ connectionId: conn.connection_id, ...params })
          .catch(() => {
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
        ?.filter((existingDomain) => {
          const updatedDomain = organizationDiscoveryDomains?.find(
            (d) => d.domain === existingDomain.domain
          );
          return updatedDomain && updatedDomain.status !== existingDomain.status;
        })
        .map((existingDomain) => ({
          id: existingDomain.id,
          domain: existingDomain.domain,
          status: organizationDiscoveryDomains.find((d) => d.domain === existingDomain.domain)
            .status,
        })) || [];

    // Handle updates first
    await Promise.all(
      orgDiscoveryDomainsToUpdate.map((domainUpdate) =>
        this.updateOrganizationDiscoveryDomain(
          params.id,
          domainUpdate.id,
          domainUpdate.domain,
          domainUpdate.status
        ).catch((err) => {
          throw new Error(
            `Problem updating discovery domain ${domainUpdate.domain} for organization ${params.id}\n${err.message}`
          );
        })
      )
    );

    await Promise.all(
      orgDiscoveryDomainsToAdd.map((domain) =>
        this.createOrganizationDiscoveryDomain(params.id, {
          domain: domain.domain,
          status: domain.status,
        }).catch((err) => {
          throw new Error(
            `Problem adding discovery domain ${domain.domain} for organization ${params.id}\n${err.message}`
          );
        })
      )
    );

    if (orgDiscoveryDomainsToRemove.length > 0) {
      if (
        this.config('AUTH0_ALLOW_DELETE') === 'true' ||
        this.config('AUTH0_ALLOW_DELETE') === true
      ) {
        await Promise.all(
          orgDiscoveryDomainsToRemove.map((domain) =>
            this.deleteOrganizationDiscoveryDomain(params.id, domain.domain, domain.id).catch(
              (err) => {
                throw new Error(
                  `Problem removing discovery domain ${domain.domain} for organization ${params.id}\n${err.message}`
                );
              }
            )
          )
        );
      } else {
        log.warn(`Detected the following organization discovery domains should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${orgDiscoveryDomainsToRemove.map((i) => this.objString(i)).join('\n')}`);
      }
    }

    return params;
  }

  getClientGrantIDByClientName(clientsName: string): string {
    const found = this.formattedClientGrants.find((c) => c.client_id === clientsName);
    return found?.grant_id || '';
  }

  async getFormattedClientGrants(): Promise<FormattedClientGrants[]> {
    const [clients, clientGrants] = await Promise.all([
      paginate<Client>(this.client.clients.getAll, {
        paginate: true,
        include_totals: true,
      }),
      paginate<ClientGrant>(this.client.clientGrants.getAll, {
        paginate: true,
        include_totals: true,
      }),
    ]);

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
              this.didUpdate(data);
              this.updated += 1;
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

    if (!this.client.organizations || typeof this.client.organizations.getAll !== 'function') {
      return [];
    }

    try {
      const [organizations, clients] = await Promise.all([
        paginate<GetOrganizations200ResponseOneOfInner>(this.client.organizations.getAll, {
          checkpoint: true,
          include_totals: true,
        }),
        paginate<Client>(this.client.clients.getAll, {
          paginate: true,
          include_totals: true,
        }),
      ]);

      for (let index = 0; index < organizations.length; index++) {
        // Get enabled connections for each organization
        const { data: connections } = await this.client.organizations.getEnabledConnections({
          id: organizations[index].id,
        });
        organizations[index].connections = connections;

        // Get client grants for each organization
        const organizationClientGrants = await this.getOrganizationClientGrants(
          organizations[index].id
        );
        organizations[index].client_grants = organizationClientGrants?.map((clientGrant) => ({
          client_id: convertClientIdToName(clientGrant.client_id, clients),
        }));

        // Get discovery domains for each organization
        const organizationDiscoveryDomains = await this.getAllOrganizationDiscoveryDomains(
          organizations[index].id
        );
        if (organizationDiscoveryDomains) {
          organizations[index].discovery_domains = organizationDiscoveryDomains;
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
    // Gets organizations from destination tenant
    const existing = await this.getType();

    const existingConnections = await paginate<Connection>(this.client.connections.getAll, {
      checkpoint: true,
      include_totals: true,
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

    const myChanges = [
      { del: changes.del },
      { create: changes.create },
      { update: changes.update },
    ];

    await Promise.all(
      myChanges.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteOrganizations(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.createOrganizations(changes.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.updateOrganizations(change.update, existing);
            break;
          default:
            break;
        }
      })
    );
  }

  async getOrganizationClientGrants(
    organizationId: string
  ): Promise<GetOrganizationClientGrants200ResponseOneOfInner[]> {
    // paginate without paginate<T> helper as this is not getAll but getOrganizationClientGrants
    // paginate through all oranizaion client grants for oranizaion id
    const allOrganizationClientGrants: GetOrganizationClientGrants200ResponseOneOfInner[] = [];
    let page = 0;
    while (true) {
      const {
        data: { client_grants: organizationClientGrants, total },
      } = await this.client.organizations.getOrganizationClientGrants({
        id: organizationId,
        page: page,
        per_page: 100,
        include_totals: true,
      });

      // if we get an unexpected response, break the loop to avoid infinite loop
      if (!isArray(organizationClientGrants) || typeof total !== 'number') {
        break;
      }

      allOrganizationClientGrants.push(...organizationClientGrants);
      page += 1;

      if (allOrganizationClientGrants.length === total) {
        break;
      }
    }

    return allOrganizationClientGrants;
  }

  async createOrganizationClientGrants(
    organizationId: string,
    grantId: string
  ): Promise<GetOrganizationClientGrants200ResponseOneOfInner> {
    log.debug(`Creating organization client grant ${grantId} for organization ${organizationId}`);
    const { data: organizationClientGrants } =
      await this.client.organizations.postOrganizationClientGrants(
        {
          id: organizationId,
        },
        {
          grant_id: grantId,
        }
      );

    return organizationClientGrants;
  }

  async deleteOrganizationClientGrants(organizationId: string, grantId: string): Promise<void> {
    log.debug(`Deleting organization client grant ${grantId} for organization ${organizationId}`);
    await this.client.organizations.deleteClientGrantsByGrantId({
      id: organizationId,
      grant_id: grantId,
    });
  }

  async getAllOrganizationDiscoveryDomains(
    organizationId: string
  ): Promise<OrganizationDiscoveryDomain[] | null> {
    // paginate using checkpoint pagination for getAllDiscoveryDomains
    const allDiscoveryDomains: OrganizationDiscoveryDomain[] = [];

    const requestArgs: any = { id: organizationId, take: 50 };
    let next: string | undefined;

    try {
      do {
        if (next) {
          requestArgs.from = next;
        } else {
          delete requestArgs.from;
        }

        const rsp = await this.client.pool
          .addSingleTask({
            data: requestArgs,
            generator: (args) => this.client.organizations.getAllDiscoveryDomains(args),
          })
          .promise();
        const discoveryDomains = Array.isArray(rsp.data) ? rsp.data : rsp.data?.domains || [];

        allDiscoveryDomains.push(...discoveryDomains);
        next = rsp.data?.next;
      } while (next);

      return allDiscoveryDomains;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (err.statusCode === 403) {
        log.warn(
          `Error fetching discovery domains for organization ${organizationId}: ${err.message}`
        );
        return null;
      }
      throw err;
    }
  }

  async getOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomainId: string
  ): Promise<GetOrganizationDiscoveryDomainResponseContent> {
    const { data } = await this.client.organizations.getDiscoveryDomain({
      id: organizationId,
      discovery_domain_id: discoveryDomainId,
    });
    return data;
  }

  async createOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomain: CreateOrganizationDiscoveryDomainRequestContent
  ): Promise<CreateOrganizationDiscoveryDomainResponseContent> {
    log.debug(
      `Creating discovery domain ${discoveryDomain.domain} for organization ${organizationId}`
    );
    const { data } = await this.client.pool
      .addSingleTask({
        data: {
          id: organizationId,
        },
        generator: (args) => this.client.organizations.createDiscoveryDomain(args, discoveryDomain),
      })
      .promise();
    return data;
  }

  async updateOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomainId: string,
    discoveryDomain: string,
    status: OrganizationDiscoveryDomainStatus
  ): Promise<UpdateOrganizationDiscoveryDomainResponseContent> {
    log.debug(`Updating discovery domain ${discoveryDomain} for organization ${organizationId}`);

    // stripUpdateFields does not support in sub modules
    const stripUpdateFields = ['verification_host', 'verification_txt'];
    log.debug(
      `Stripping ${this.type} discovery domain read-only fields ${JSON.stringify(
        stripUpdateFields
      )}`
    );

    const { data } = await this.client.pool
      .addSingleTask({
        data: {
          id: organizationId,
          discovery_domain_id: discoveryDomainId,
        },
        generator: (args) =>
          this.client.organizations.updateDiscoveryDomain(args, {
            status,
          }),
      })
      .promise();
    return data;
  }

  async deleteOrganizationDiscoveryDomain(
    organizationId: string,
    discoveryDomain: string,
    discoveryDomainId: string
  ): Promise<void> {
    log.debug(`Deleting discovery domain ${discoveryDomain} for organization ${organizationId}`);
    await this.client.pool
      .addSingleTask({
        data: {
          id: organizationId,
          discovery_domain_id: discoveryDomainId,
        },
        generator: (args) => this.client.organizations.deleteDiscoveryDomain(args),
      })
      .promise();
  }
}
