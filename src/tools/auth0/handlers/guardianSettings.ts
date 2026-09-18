import { Management } from 'auth0';
import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';
import { isDryRun, isFeatureUnavailableError, isForbiddenFeatureError } from '../../utils';

export const schema = {
  type: 'object',
  properties: {
    display_remember_me_checkbox: {
      type: 'boolean',
      description:
        'Determines whether to display the "Remember Me" checkbox on the MFA prompt in Universal Login.',
    },
    remember_me_default_value: {
      type: 'boolean',
      description:
        'Determines the default state of the "Remember Me" checkbox on the MFA prompt in Universal Login.',
    },
    mfa_session_inactivity_timeout: {
      type: 'number',
      description:
        'Duration of inactivity (seconds) after which the user will be prompted for MFA. Cannot exceed the overall timeout.',
    },
    mfa_session_overall_timeout: {
      type: 'number',
      description:
        'Maximum duration (seconds) after which the user will be prompted for MFA regardless of activity.',
    },
  },
  additionalProperties: false,
};

export default class GuardianSettingsHandler extends DefaultHandler {
  existing: Asset;

  constructor(options) {
    super({
      ...options,
      type: 'guardianSettings',
    });
  }

  async getType(): Promise<Asset | null> {
    if (this.existing) return this.existing;

    try {
      const data = await this.client.guardian.get();
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
    // No API to delete or create guardianSettings, we can only update.
    const { guardianSettings } = assets;

    // Do nothing if not set
    if (!guardianSettings) {
      return;
    }

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    try {
      await this.client.guardian.set(
        guardianSettings as Management.SetGuardianSettingsRequestContent
      );
    } catch (err) {
      if (isFeatureUnavailableError(err) || isForbiddenFeatureError(err, this.type)) {
        // Feature is unavailable (404) or disabled (403) on this tenant; skip instead of failing
        // the import. The 403 path logs a warning via isForbiddenFeatureError; the 404 path is silent.
        return;
      }
      throw err;
    }
    this.updated += 1;
    this.didUpdate(guardianSettings);
  }
}
