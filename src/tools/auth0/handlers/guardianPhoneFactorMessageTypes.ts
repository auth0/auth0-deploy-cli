import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    message_types: {
      type: 'array',
      items: {
        type: 'string',
        enum: constants.GUARDIAN_PHONE_MESSAGE_TYPES,
      },
    },
  },
  additionalProperties: false,
};

const isFeatureUnavailableError = (err): boolean => {
  if (err.statusCode === 404) {
    // Older Management API version where the endpoint is not available.
    return true;
  }
  if (
    err.statusCode === 403 &&
    err.originalError &&
    err.originalError.response &&
    err.originalError.response.body &&
    err.originalError.response.body.errorCode === 'voice_mfa_not_allowed'
  ) {
    // Recent Management API version, but with feature explicitly disabled.
    return true;
  }
  return false;
};

export default class GuardianPhoneMessageTypesHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'guardianPhoneFactorMessageTypes',
    });
  }

  async getType(): Promise<Asset[] | {}> {
    // in case client version does not support the operation
    if (
      !this.client.guardian ||
      typeof this.client.guardian.getPhoneFactorMessageTypes !== 'function'
    ) {
      return {};
    }

    if (this.existing) return this.existing;

    try {
      this.existing = await this.client.guardian.getPhoneFactorMessageTypes();
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
    // No API to delete or create guardianPhoneFactorMessageTypes, we can only update.
    const { guardianPhoneFactorMessageTypes } = assets;

    // Do nothing if not set
    if (!guardianPhoneFactorMessageTypes || !guardianPhoneFactorMessageTypes.message_types) return;

    const params = {};
    const data = guardianPhoneFactorMessageTypes;
    await this.client.guardian.updatePhoneFactorMessageTypes(params, data);
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorMessageTypes);
  }
}
