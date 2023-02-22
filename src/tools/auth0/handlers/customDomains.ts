import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      custom_domain_id: { type: 'string' },
      custom_client_ip_header: {
        type: 'string',
        nullable: true,
        enum: ['true-client-ip', 'cf-connecting-ip', 'x-forwarded-for', null],
      },
      domain: { type: 'string' },
      primary: { type: 'boolean' },
      status: { type: 'string', enum: ['pending_verification', 'ready', 'disabled', 'pending'] },
      type: { type: 'string', enum: ['auth0_managed_certs', 'self_managed_certs'] },
      verification: { type: 'object' },
    },
    required: ['domain', 'type'],
  },
};

export default class CustomDomainsHadnler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'customDomains',
      id: 'custom_domain_id',
      identifiers: ['domain'],
      stripCreateFields: ['status', 'primary', 'verification'],
      functions: {
        delete: (args) => this.client.customDomains.delete({ id: args.custom_domain_id }),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.domain);
  }

  async getType(): Promise<Asset | null> {
    try {
      if (this.existing) {
        return this.existing;
      }

      const customDomains = await this.client.customDomains.getAll({ paginate: false });

      this.existing = customDomains;

      return customDomains;
    } catch (err) {
      if (
        err.statusCode === 403 &&
        err.message ===
          'The account is not allowed to perform this operation, please contact our support team'
      ) {
        return [];
      }
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { customDomains } = assets;

    if (!customDomains) return;
    const changes = await this.calcChanges(assets).then((changes) => {
      const changesWithoutUpdates = {
        ...changes,
        create: changes.create.map((customDomainToCreate) => {
          const newCustomDomain = { ...customDomainToCreate };
          if (customDomainToCreate.custom_client_ip_header === null) {
            delete newCustomDomain.custom_client_ip_header;
          }

          return newCustomDomain;
        }),
        delete: changes.del.map((deleteToMake) => {
          const deleteWithSDKCompatibleID = {
            ...deleteToMake,
            id: deleteToMake.custom_domain_id,
          };
          delete deleteWithSDKCompatibleID['custom_domain_id'];
          return deleteWithSDKCompatibleID;
        }),
        update: [], //Do not perform custom domain updates because not supported by SDK
      };
      return changesWithoutUpdates;
    });

    await super.processChanges(assets, changes);
  }
}
