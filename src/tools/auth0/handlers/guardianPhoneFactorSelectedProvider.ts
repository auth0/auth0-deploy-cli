import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';
import { GetPhoneProviders200Response } from 'auth0';

export const schema = {
  type: 'object',
  properties: {
    provider: {
      type: 'string',
      enum: constants.GUARDIAN_PHONE_PROVIDERS,
    },
  },
  additionalProperties: false,
};

const isFeatureUnavailableError = (err) => {
  if (err.statusCode === 404) {
    // Older Management API version where the endpoint is not available.
    return true;
  }
  if (
    err.statusCode === 403 &&
    err.originalError &&
    err.originalError.response &&
    err.originalError.response.body &&
    err.originalError.response.body.errorCode === 'hooks_not_allowed'
  ) {
    // Recent Management API version, but with feature explicitly disabled.
    return true;
  }
  return false;
};

export default class GuardianPhoneSelectedProviderHandler extends DefaultHandler {
  existing: Asset;

  constructor(options) {
    super({
      ...options,
      type: 'guardianPhoneFactorSelectedProvider',
    });
  }

  async getType() {
    // in case client version does not support the operation
    if (
      !this.client.guardian ||
      typeof this.client.guardian.getPhoneFactorSelectedProvider !== 'function'
    ) {
      return {};
    }

    if (this.existing) return this.existing;

    try {
      const { data } = await this.client.guardian.getPhoneFactorSelectedProvider();
      this.existing = data;
    } catch (e) {
      if (isFeatureUnavailableError(e)) {
        // Gracefully skip processing this configuration value.
        return {};
      }
      throw e;
    }

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianPhoneFactorSelectedProvider, we can only update.
    const { guardianPhoneFactorSelectedProvider } = assets;

    // Do nothing if not set
    if (!guardianPhoneFactorSelectedProvider || !guardianPhoneFactorSelectedProvider.provider)
      return;

    const data = guardianPhoneFactorSelectedProvider;
    await this.client.guardian.updatePhoneFactorSelectedProvider(data as GetPhoneProviders200Response);
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorSelectedProvider);
  }
}
