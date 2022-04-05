import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';

const mappings = Object.entries(constants.GUARDIAN_FACTOR_PROVIDERS).reduce(
  (accum: { name: string; provider: string }[], [name, providers]) => {
    providers.forEach((p) => {
      accum.push({ name, provider: p });
    });
    return accum;
  },
  []
);

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: constants.GUARDIAN_FACTORS },
      provider: { type: 'string', enum: mappings.map((p) => p.provider) },
    },
    required: ['name', 'provider'],
  },
};

export default class GuardianFactorProvidersHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'guardianFactorProviders',
      id: 'name',
    });
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

    const data = await Promise.all(
      mappings.map(async (m) => {
        const provider = await this.client.guardian.getFactorProvider(m);
        return { ...m, ...provider };
      })
    );

    // Filter out empty, should have more then 2 keys (name, provider)
    return data.filter((d) => Object.keys(d).length > 2);
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianFactorProviders, we can only update.
    const { guardianFactorProviders } = assets;

    // Do nothing if not set
    if (!guardianFactorProviders || !guardianFactorProviders.length) return;

    // Process each factor
    await Promise.all(
      guardianFactorProviders.map(async (factorProvider) => {
        const data = { ...factorProvider };
        const params = { name: factorProvider.name, provider: factorProvider.provider };
        delete data.name;
        delete data.provider;
        await this.client.guardian.updateFactorProvider(params, data);
        this.didUpdate(params);
        this.updated += 1;
      })
    );
  }
}
