import { GetPhoneProviders200Response } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';
import { isDryRun, isForbiddenFeatureError } from '../../utils';

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

  async getType(): Promise<Asset | null> {
    // in case client version does not support the operation
    if (
      !this.client.guardian ||
      typeof this.client.guardian.getPhoneFactorSelectedProvider !== 'function'
    ) {
      return null;
    }

    if (this.existing) return this.existing;

    try {
      const { data } = await this.client.guardian.getPhoneFactorSelectedProvider();
      this.existing = data;
    } catch (err) {
      if (isFeatureUnavailableError(err)) {
        // Gracefully skip processing this configuration value.
        return null;
      }
      if (isForbiddenFeatureError(err, this.type)) {
        return null;
      }
      throw err;
    }

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianPhoneFactorSelectedProvider, we can only update.
    const { guardianPhoneFactorSelectedProvider } = assets;

    // Do nothing if not set
    if (!guardianPhoneFactorSelectedProvider || !guardianPhoneFactorSelectedProvider.provider) {
      return;
    }

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    const data = guardianPhoneFactorSelectedProvider;
    await this.client.guardian.updatePhoneFactorSelectedProvider(
      data as GetPhoneProviders200Response
    );
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorSelectedProvider);
  }
}
