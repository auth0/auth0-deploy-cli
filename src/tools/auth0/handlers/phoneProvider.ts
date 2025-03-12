import {
  CreatePhoneProviderRequest,
  DeletePhoneProviderRequest,
  GetBrandingPhoneProviders200ResponseProvidersInner,
  UpdatePhoneProviderOperationRequest
} from 'auth0';
import DefaultHandler, { order } from './default';
import { Assets } from '../../../types';
import log from '../../../logger';

export type PhoneProvider = GetBrandingPhoneProviders200ResponseProvidersInner;
export default class PhoneProviderHandler extends DefaultHandler {
  existing: PhoneProvider[] | null;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'phoneProviders',
      id: 'id',
    });
  }

  objString(provider: PhoneProvider) : string {
    return super.objString({ name: provider.name, disabled: provider.disabled }); //Que
  }

  async getType(): Promise<PhoneProvider[] | null> {
    if (!this.existing) {
      this.existing = await this.getPhoneProviders();
    }

    return this.existing;
  }

  async getPhoneProviders(): Promise<PhoneProvider[] | null> {
    const { data: response } = await this.client.branding.getAllPhoneProviders();
    return response.providers ?? [];
  }

  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { phoneProviders } = assets;

    // Non-existing section means themes doesn't need to be processed
    if (!phoneProviders) return;

    // Empty array means themes should be deleted
    if (phoneProviders.length === 0) {
      return this.deletePhoneProviders();
    }

    return this.updatePhoneProviders(phoneProviders);
  }

  async deletePhoneProviders(): Promise<void> {
    if (!this.config('AUTH0_ALLOW_DELETE')) {
      return;
    }

    // if phone providers exists we need to delete it
    const currentProviders = await this.getPhoneProviders();
    if (currentProviders === null || currentProviders.length === 0) {
      return;
    }

    const currentProvider = currentProviders[0];
    await this.client.branding.deletePhoneProvider(<DeletePhoneProviderRequest>{ id: currentProvider.id });
    // await this.client.branding.deletePhoneProvider({ 'id': currentProvider.id }); //Quee

    this.deleted += 1;
    this.didDelete(currentProvider);
  }

  async updatePhoneProviders(phoneProviders: PhoneProvider[]): Promise<void> {
    if (phoneProviders.length > 1) {
      log.warn('Currently only one phone provider is supported per tenant');
    }

    const currentProviders = await this.getPhoneProviders();

    const providerReqPayload = ((): Omit<PhoneProvider, 'id'> => {
      // Removing id from update and create payloads, otherwise API will error
      // id may be required to handle if `--export_ids=true`
      const payload = phoneProviders[0];
      // @ts-ignore to quell non-optional id property, but we know that it's ok to delete
      delete payload.id;
      return payload;
    })();

    if (currentProviders === null || currentProviders.length === 0) {
      // if provider does not exist, create it
      this.created += 1;
      await this.client.branding.configurePhoneProvider(providerReqPayload as CreatePhoneProviderRequest);
    } else {
      const currentProvider = currentProviders[0];
      // if provider exists, overwrite it
      await this.client.branding.updatePhoneProvider({ id: currentProvider.id } as UpdatePhoneProviderOperationRequest, providerReqPayload);

      this.updated += 1;
      this.didUpdate(phoneProviders[0]);
    }
  }
}

const TwilioCredentialsSchema = {
  type: 'object',
  required: ['auth_token'],
  properties: {
    auth_token: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
  },
  additionalProperties: false,
};

const TwilioConfigurationSchema = {
  type: 'object',
  required: ['sid', 'delivery_methods'],
  additionalProperties: false,
  properties: {
    default_from: {
      type: 'string',
    },
    mssid: {
      type: 'string',
    },
    sid: {
      type: 'string',
    },
    delivery_methods: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['text', 'voice'],
      },
      minItems: 1,
      uniqueItems: true,
    },
  },
};

const CustomCredentialsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

const CustomConfigurationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['delivery_methods'],
  properties: {
    delivery_methods: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['text', 'voice'],
      },
      minItems: 1,
      uniqueItems: true,
    },
  },
};

export const schema = {
  type: 'array',
  description: 'List of phone provider configurations',
  items: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
      },
      name: {
        type: 'string',
        description: 'Name of the phone notification provider',
        enum: ['twilio', 'custom'],
        minLength: 1,
        maxLength: 100,
      },
      disabled: {
        type: 'boolean',
        description: 'Whether the provider is enabled (false) or disabled (true).',
        defaultValue: false,
      },
      configuration: {
        type: 'object',
        anyOf: [TwilioConfigurationSchema, CustomConfigurationSchema],
      },
      credentials: {
        description: 'Provider credentials required to authenticate to the provider.',
        anyOf: [TwilioCredentialsSchema, CustomCredentialsSchema],
      },
    },
    additionalProperties: false,
  },
};
