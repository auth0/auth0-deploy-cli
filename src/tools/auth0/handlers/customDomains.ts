import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import ValidationError from '../../validationError';
import { Asset, Assets } from '../../../types';
import log from '../../../logger';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      custom_domain_id: { type: 'string' },
      custom_client_ip_header: {
        type: 'string',
        nullable: true,
        enum: ['true-client-ip', 'cf-connecting-ip', 'x-forwarded-for', null],
      },
      domain: { type: 'string' },
      primary: { type: 'boolean' },
      status: { type: 'string' },
      type: { type: 'string', enum: ['auth0_managed_certs', 'self_managed_certs'] },
      verification: { type: 'object' },
      tls_policy: {
        type: 'string',
        description: 'Custom domain TLS policy. Must be `recommended`, includes TLS 1.2.',
        defaultValue: 'recommended',
      },
      domain_metadata: {
        type: 'object',
        description: 'Domain metadata associated with the custom domain.',
        defaultValue: undefined,
        maxProperties: 10,
      },
      verification_method: {
        type: 'string',
        description: 'Custom domain verification method. Must be `txt`.',
        defaultValue: 'txt',
      },
      relying_party_identifier: {
        type: ['string'],
        description:
          'Relying Party ID (rpId) to be used for Passkeys on this custom domain. If not provided or set to null, the full domain will be used.',
      },
      is_default: {
        type: 'boolean',
        description:
          'Whether this custom domain is the default domain used for email notifications.',
      },
    },
    required: ['domain', 'type'],
  },
};

type CustomDomain = Management.CustomDomain;

export default class CustomDomainsHadnler extends DefaultAPIHandler {
  existing: CustomDomain[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'customDomains',
      id: 'custom_domain_id',
      identifiers: ['custom_domain_id', 'domain'],
      stripCreateFields: [
        'status',
        'primary',
        'verification',
        'certificate',
        'created_at',
        'updated_at',
        'is_default',
      ],
      stripUpdateFields: [
        'status',
        'primary',
        'verification',
        'type',
        'domain',
        'verification_method',
        'certificate',
        'created_at',
        'updated_at',
        'is_default',
      ],
    });
  }

  objString(item: Asset): string {
    return super.objString(item.domain);
  }

  async getType(): Promise<Asset | null> {
    try {
      if (this.existing) {
        return this.existing;
      }

      const customDomains = await this.client.customDomains.list();

      this.existing = customDomains;

      return customDomains;
    } catch (err) {
      if (
        err.statusCode === 403 &&
        err.message ===
          'The account is not allowed to perform this operation, please contact our support team'
      ) {
        return null;
      }
      throw err;
    }
  }

  async validate(assets: Assets): Promise<void> {
    await super.validate(assets);

    const { customDomains } = assets;
    if (!customDomains) return;

    const defaultDomains = customDomains.filter((d) => d.is_default === true);
    if (defaultDomains.length > 1) {
      throw new ValidationError(
        `Only one custom domain can be set as default (is_default: true), but found ${
          defaultDomains.length
        }: ${defaultDomains.map((d) => d.domain).join(', ')}`
      );
    }
  }

  @order('50')
  async processChanges(assets: Assets): Promise<void> {
    const { customDomains } = assets;

    if (!customDomains) return;

    // Deprecation warnings for custom domains
    if (customDomains.some((customDomain) => customDomain.primary != null)) {
      log.warn(
        'The "primary" field is deprecated and may be removed in future versions for "customDomains"'
      );
    }

    if (customDomains.some((customDomain) => 'verification_method' in customDomain)) {
      log.warn(
        'The "verification_method" field is deprecated and may be removed in future versions for "customDomains"'
      );
    }

    const changes = await this.calcChanges(assets);
    await super.processChanges(assets, changes);

    // If a domain is marked as is_default, set it as the tenant's default custom domain.
    const defaultDomain = customDomains.find((d) => d.is_default === true);
    if (defaultDomain) {
      try {
        await this.client.customDomains.setDefault({ domain: defaultDomain.domain });
        log.info(`Set default custom domain: ${defaultDomain.domain}`);
      } catch (err) {
        throw new Error(`Problem setting default custom domain ${defaultDomain.domain}\n${err}`);
      }
    }
  }
}
