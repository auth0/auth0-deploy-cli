import DefaultHandler from './default';
import constants from '../../constants';
import log from '../../../logger';

export const schema = {
  type: 'object',
  properties: {
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          template: { type: 'string' },
          body: { type: 'string' }
        }
      }
    }
  }
};

export default class BrandingHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'branding'
    });
  }

  async getType() {
    let branding = {};

    try {
      // in case client version does not support branding
      if (this.client.branding && typeof this.client.branding.getSettings === 'function') {
        branding = await this.client.branding.getSettings();
      }

      // in case client version does not custom domains
      if (this.client.customDomains && typeof this.client.customDomains.getAll === 'function') {
        const customDomains = await this.client.customDomains.getAll();
        // templates are only supported if there's custom domains.
        if (customDomains && customDomains.length) {
          const payload = await this.client.branding.getUniversalLoginTemplate();
          branding.templates = [
            {
              template: constants.UNIVERSAL_LOGIN_TEMPLATE,
              body: payload.body
            }
          ];
        }
      }

      return branding;
    } catch (err) {
      log.debug(`Error calling branding API, ${err.message}, status code: ${err.statusCode}`);
      if (err.statusCode === 403) return branding;
      if (err.statusCode === 404) return branding;
      if (err.statusCode === 501) return branding;
      throw err;
    }
  }

  async processChanges(assets) {
    const { branding } = assets;

    // quit early if there's no branding to process.
    if (!branding) return;

    // remove templates, we only want top level branding settings for this API call
    const brandingSettings = { ...branding };
    delete brandingSettings.templates;
    // Do nothing if not set
    if (brandingSettings && Object.keys(brandingSettings).length) {
      await this.client.branding.updateSettings({}, brandingSettings);
      this.updated += 1;
      this.didUpdate(brandingSettings);
    }

    // handle templates
    if (branding.templates && branding.templates.length) {
      const unknownTemplates = branding.templates.filter((t) => !constants.SUPPORTED_BRANDING_TEMPLATES.includes(t.template)).map((t) => t.template);
      if (unknownTemplates.length) {
        // throw a helpful warning for unknown templates, the context handlers are unaware of which are supported, that's all handled here.
        log.warn(`Found unknown branding template(s): ${unknownTemplates.join().toString()}. Supported branding templates are: ${constants.SUPPORTED_BRANDING_TEMPLATES.join()}.`);
      }

      const templateDefinition = branding.templates.find((t) => t.template === constants.UNIVERSAL_LOGIN_TEMPLATE);
      if (templateDefinition && templateDefinition.body) {
        await this.client.branding.setUniversalLoginTemplate({}, { template: templateDefinition.body });
        this.updated += 1;
        this.didUpdate(branding.templates);
      }
    }
  }
}
