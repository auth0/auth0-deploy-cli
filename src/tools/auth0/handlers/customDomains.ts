import { CustomDomain } from 'auth0';
import DefaultAPIHandler, { order } from './default';
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
      status: { type: 'string', enum: ['pending_verification', 'ready', 'disabled', 'pending'] },
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
    },
    required: ['domain', 'type'],
  },
};

export default class CustomDomainsHadnler extends DefaultAPIHandler {
  existing: Asset[] | null;

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
      ],
      functions: {
        delete: (args) => this.client.customDomains.delete({ id: args.custom_domain_id }),
        update: (args, data) =>
          this.client.customDomains.update({ id: args.custom_domain_id }, data),
      },
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

      const { data: customDomains } = await this.client.customDomains.getAll();

      this.existing = customDomains as CustomDomain[];

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
  }
}
