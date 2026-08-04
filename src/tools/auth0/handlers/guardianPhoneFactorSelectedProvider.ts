import { Management } from 'auth0';
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
  // 403s (feature explicitly disabled) are handled by isForbiddenFeatureError.
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
    if (this.existing) return this.existing;

    try {
      const data = await this.client.guardian.factors.phone.getSelectedProvider();
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
    try {
      await this.client.guardian.factors.phone.setProvider(
        data as Management.SetGuardianFactorsProviderPhoneRequestContent
      );
    } catch (err) {
      if (isFeatureUnavailableError(err) || isForbiddenFeatureError(err, this.type)) {
        // Feature is deprecated/disabled on this tenant; warn and skip instead of failing the import.
        return;
      }
      throw err;
    }
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorSelectedProvider);
  }
}
