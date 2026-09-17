import { Management } from 'auth0';
import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';
import { isDryRun, isForbiddenFeatureError } from '../../utils';

export const schema = {
  type: 'object',
  properties: {
    otp_length: {
      type: 'number',
      description: 'The length of the OTP code.',
    },
    otp_expiration_time: {
      type: 'number',
      description: 'The OTP expiration time in seconds.',
    },
  },
  additionalProperties: false,
};

const isFeatureUnavailableError = (err): boolean => {
  if (err.statusCode === 404) {
    // Older Management API version where the endpoint is not available.
    return true;
  }
  // 403s (feature explicitly disabled) are handled by isForbiddenFeatureError.
  return false;
};

export default class GuardianPhoneFactorSettingsHandler extends DefaultHandler {
  existing: Asset;

  constructor(options) {
    super({
      ...options,
      type: 'guardianPhoneFactorSettings',
    });
  }

  async getType(): Promise<Asset | null> {
    if (this.existing) return this.existing;

    try {
      const data = await this.client.guardian.factors.phone.get();
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
    // No API to delete or create guardianPhoneFactorSettings, we can only update.
    const { guardianPhoneFactorSettings } = assets;

    // Do nothing if not set
    if (!guardianPhoneFactorSettings) {
      return;
    }

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    try {
      await this.client.guardian.factors.phone.set(
        guardianPhoneFactorSettings as Management.SetPhoneFactorSettingsRequestContent
      );
    } catch (err) {
      if (isFeatureUnavailableError(err) || isForbiddenFeatureError(err, this.type)) {
        // Feature is deprecated/disabled on this tenant; warn and skip instead of failing the import.
        return;
      }
      throw err;
    }
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorSettings);
  }
}
