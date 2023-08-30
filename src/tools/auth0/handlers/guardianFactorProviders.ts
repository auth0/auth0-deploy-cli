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
        let provider;
        // TODO: This is quite a change, needs to be validated for sure.
        if (m.name === 'phone' && m.provider === 'twilio') {
          provider = await this.client.guardian.getPhoneFactorProviderTwilio();
        } else if (m.name === 'sms' && m.provider === 'twilio') {
            provider = await this.client.guardian.getSmsFactorProviderTwilio();
        } else if (m.name === 'push-notification' && m.provider === 'apns') {
            provider = await this.client.guardian.getPushNotificationProviderAPNS();
        } else if (m.name === 'push-notification' && m.provider === 'sns') {
          provider = await this.client.guardian.getPushNotificationProviderSNS();
        }

        return { ...m, ...provider.data };
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
        const { name, provider, ...data } = factorProvider;
        const params = { name: factorProvider.name, provider: factorProvider.provider };
        // TODO: This is quite a change, needs to be validated for sure.
        if (name === 'phone' && provider === 'twilio') {
          await this.client.guardian.updatePhoneFactorProviderTwilio(data);
        } else if (name === 'push-notification' && provider === 'apns') {
          await this.client.guardian.updatePushNotificationProviderAPNS(data);
        } else if (name === 'push-notification' && provider === 'fcm') {
          await this.client.guardian.updatePushNotificationProviderFCM(data);
        } else if (name === 'push-notification' && provider === 'sns') {
          await this.client.guardian.updatePushNotificationProviderSNS(data);
        }
        this.didUpdate(params);
        this.updated += 1;
      })
    );
  }
}
