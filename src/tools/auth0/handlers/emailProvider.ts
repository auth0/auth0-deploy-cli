import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';

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
      return await this.client.emailProvider.get({ include_fields: true, fields: defaultFields });
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

    if (Object.keys(emailProvider).length === 0 && this.config('AUTH0_ALLOW_DELETE') === true) {
      await this.client.emailProvider.delete();
      this.didDelete(existing);
      return;
    }

    if (existing.name) {
      if (existing.name !== emailProvider.name) {
        // Delete the current provider as it's different
        await this.client.emailProvider.delete();
        this.didDelete(existing);
        existing = {};
      }
    }

    if (existing.name) {
      const provider = { name: emailProvider.name, enabled: emailProvider.enabled };
      const updated = await this.client.emailProvider.update(provider, emailProvider);
      this.updated += 1;
      this.didUpdate(updated);
    } else {
      const provider = { name: emailProvider.name, enabled: emailProvider.enabled };
      const created = await this.client.emailProvider.configure(provider, emailProvider);
      this.created += 1;
      this.didCreate(created);
    }
  }
}
