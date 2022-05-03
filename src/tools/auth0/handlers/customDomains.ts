import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      custom_domain_id: { type: 'string' },
      domain: { type: 'string' },
      primary: { type: 'boolean' },
      status: { type: 'string', enum: ['pending_verification', 'ready', 'disabled', 'pending'] },
      type: { type: 'string', enum: ['auth0_managed_certs', 'self_managed_certs'] },
      verifications: { type: 'object' },
    },
    required: ['domain'],
  },
};

// type CustomDomain = {
//   type: 'eventbridge' | 'eventgrid' | 'datadog' | 'http' | 'splunk' | 'sumo';
//   name: string;
//   id: string;
//   status: 'active' | 'suspended' | 'paused';
//   sink?: {
//     [key: string]: string | boolean;
//   };
// };

export default class CustomDomainsHadnler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'customDomains',
      id: 'custom_domain_id',
      identifiers: ['domain'],
      stripCreateFields: ['verification'],
      functions: {
        //@ts-ignore
        delete: (args) => {
          console.log({ args });
          return new Promise(() => 5);
        },
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const customDomains = await this.client.customDomains.getAll({ paginate: false });

    this.existing = customDomains;

    return customDomains;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { customDomains } = assets;
    // Do nothing if not set
    if (!customDomains) return;
    // Figure out what needs to be updated vs created
    const changes = await this.calcChanges(assets).then((changes) => {
      const changesWithoutUpdates = {
        ...changes,
        delete: changes.del.map((deleteToMake) => {
          const deleteWithSDKCompatibleID = {
            ...deleteToMake,
            id: deleteToMake.custom_domain_id,
          };
          delete deleteWithSDKCompatibleID['custom_domain_id'];
          return deleteWithSDKCompatibleID;
        }),
        update: [],
      };
      return changesWithoutUpdates;
    });

    await super.processChanges(assets, changes);
  }
}
