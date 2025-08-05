import { EmailProviderCreate } from 'auth0';
import { isEmpty } from 'lodash';
import DefaultHandler, { order } from './default';
import { Asset, Assets } from '../../../types';
import { isDryRun } from '../../utils';
import log from '../../../logger';

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
      const { data } = await this.client.emails.get({
        include_fields: true,
        fields: defaultFields.join(','),
      });
      return data;
    } catch (err) {
      if (err.statusCode === 404) return {};
      throw err;
    }
  }

  objString(provider) {
    return super.objString({ name: provider.name, enabled: provider.enabled });
  }

  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { emailProvider } = assets;

    if (!emailProvider) return;

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        log.debug(
          `Start processChanges for emailProvider [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
        );
      }
    }

    const existing = await this.getType();

    // HTTP DELETE on emails/provider is not supported, as this is not part of our vNext SDK.
    if (Object.keys(emailProvider).length === 0) {
      if (this.config('AUTH0_ALLOW_DELETE') === true) {
        // await this.client.emails.delete(); is not supported
        if (isEmpty(existing.credentials)) {
          delete existing.credentials;
        }
        const updated = await this.client.emails.update(existing);
        this.updated += 1;
        this.didUpdate(updated);
      }
      return;
    }

    if (existing.name) {
      const updated = await this.client.emails.update(emailProvider);
      this.updated += 1;
      this.didUpdate(updated);
    } else {
      const created = await this.client.emails.configure(emailProvider as EmailProviderCreate);
      this.created += 1;
      this.didCreate(created);
    }
  }
}
