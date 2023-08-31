import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';
import { PostProviderRequest } from 'auth0';

export const schema = { type: 'object' };

// The Management API requires the fields to be specified
const defaultFields = ['name', 'enabled', 'credentials', 'settings', 'default_from_address'];

export default class EmailProviderHandler extends DefaultHandler {
  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'emailProvider',
    });
  }

  async getType(): Promise<Asset> {
    try {
      const { data  } = await this.client.emails.get({ include_fields: true, fields: defaultFields.join(',') });
      return data;
    } catch (err) {
      if (err.statusCode === 404) return {};
      throw err;
    }
  }

  objString(provider) {
    return super.objString({ name: provider.name, enabled: provider.enabled });
  }

  async processChanges(assets: Assets): Promise<void> {
    const { emailProvider } = assets;

    if (!emailProvider) return;

    let existing = await this.getType();

    // TODO: HTTP DELETE on emails/provider is not public, so not part of our vNext SDK.
    if (Object.keys(emailProvider).length === 0) {
      if (this.config('AUTH0_ALLOW_DELETE') === true) {
        // await this.client.emails.delete();
        this.didDelete(existing);
      }
      return;
    }

    if (existing.name) {
      if (existing.name !== emailProvider.name) {
        // Delete the current provider as it's different
        // await this.client.emailProvider.delete();
        this.didDelete(existing);
        existing = {};
      }
    }

    if (existing.name) {
      const updated = await this.client.emails.update(emailProvider);
      this.updated += 1;
      this.didUpdate(updated);
    } else {
      const created = await this.client.emails.configure(emailProvider as PostProviderRequest);
      this.created += 1;
      this.didCreate(created);
    }
  }
}
