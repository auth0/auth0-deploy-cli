import DefaultHandler from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';

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

    // Do nothing if not set
    if (!emailProvider) return;

    if (Object.keys(emailProvider).length > 0) {
      let existing = await this.getType();

      // Check for existing Email Provider
      if (existing.name) {
        if (existing.name !== emailProvider.name) {
          // Delete the current provider as it's different
          await this.client.emailProvider.delete();
          this.didDelete(existing);
          existing = {};
        }
      }

      // Now configure or update depending if it is configured already
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
}
