import { Management } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';
import { isForbiddenFeatureError } from '../../utils';

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
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'guardianPhoneFactorMessageTypes',
    });
  }

  async getType(): Promise<Asset | null> {

    if (this.existing) return this.existing;

    try {
      const data  = await this.client.guardian.factors.phone.getMessageTypes();
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
    // No API to delete or create guardianPhoneFactorMessageTypes, we can only update.
    const { guardianPhoneFactorMessageTypes } = assets;

    // Do nothing if not set
    if (!guardianPhoneFactorMessageTypes || !guardianPhoneFactorMessageTypes.message_types) return;

    const data = guardianPhoneFactorMessageTypes;
    await this.client.guardian.factors.phone.setMessageTypes(
      data as unknown as Management.SetGuardianFactorPhoneMessageTypesRequestContent
    );
    this.updated += 1;
    this.didUpdate(guardianPhoneFactorMessageTypes);
  }
}
