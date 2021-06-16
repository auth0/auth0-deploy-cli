import DefaultHandler from './default';

export const schema = { type: 'object' };

export default class BrandingHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'branding'
    });
  }

  async getType() {
    // in case client version does not support branding
    if (!this.client.branding || typeof this.client.branding.getSettings !== 'function') {
      return {};
    }

    try {
      return await this.client.branding.getSettings();
    } catch (err) {
      if (err.statusCode === 404) return {};
      if (err.statusCode === 501) return {};
      throw err;
    }
  }

  async processChanges(assets) {
    const { branding } = assets;

    // Do nothing if not set
    if (!branding || !Object.keys(branding).length) return;

    await this.client.branding.updateSettings({}, branding);
    this.updated += 1;
    this.didUpdate(branding);
  }
}
