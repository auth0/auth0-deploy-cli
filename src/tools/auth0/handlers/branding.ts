import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          template: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
  },
};

export default class BrandingHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'branding',
    });
  }

  async getType(): Promise<Asset> {
    let branding = {};

    try {
      branding = await this.client.branding.get();

      const customDomains = await this.client.customDomains.list();

      // templates are only supported if there's custom domains.
      if (customDomains && customDomains.length) {
        let payload = await this.client.branding.templates.getUniversalLogin();
        payload = payload as Management.GetUniversalLoginTemplate;

        if (Object.keys(branding).length === 0) {
          branding = {
            templates: [
              {
                template: constants.UNIVERSAL_LOGIN_TEMPLATE,
                body: payload.body,
              },
            ],
          };
        } else {
          branding = {
            ...branding,
            templates: [
              {
                template: constants.UNIVERSAL_LOGIN_TEMPLATE,
                body: payload.body,
              },
            ],
          };
        }
      }

      return branding;
    } catch (err) {
      log.debug(`Error calling branding API, ${err.message}, status code: ${err.statusCode}`);

      if (err.statusCode === 403) {
        log.warn(
          'Insufficient scope the read:custom_domains scope is not set. Branding templates will not be exported.'
        );
        return branding;
      }

      if (err.statusCode === 404) return branding;
      if (err.statusCode === 501) return branding;
      throw err;
    }
  }

  @order('70') // Run after custom domains and themes.
  async processChanges(assets: Assets) {
    if (!assets.branding) return;

    const { templates, ...brandingSettings } = assets.branding;

    if (brandingSettings.logo_url === '') {
      // Sometimes blank logo_url returned by API but is invalid on import. See: DXCDT-240
      delete brandingSettings.logo_url;
    }

    if (brandingSettings && Object.keys(brandingSettings).length) {
      await this.client.branding.update(brandingSettings);
      this.updated += 1;
      this.didUpdate(brandingSettings);
    }

    // handle templates
    if (templates && templates.length) {
      const unknownTemplates = templates
        .filter((t) => !constants.SUPPORTED_BRANDING_TEMPLATES.includes(t.template))
        .map((t) => t.template);
      if (unknownTemplates.length) {
        // throw a helpful warning for unknown templates, the context handlers are unaware of which are supported, that's all handled here.
        log.warn(
          `Found unknown branding template(s): ${unknownTemplates
            .join()
            .toString()}. Supported branding templates are: ${constants.SUPPORTED_BRANDING_TEMPLATES.join()}.`
        );
      }

      const templateDefinition = templates.find(
        (t) => t.template === constants.UNIVERSAL_LOGIN_TEMPLATE
      );
      if (templateDefinition && templateDefinition.body) {
        await this.client.branding.templates.updateUniversalLogin({
          template: templateDefinition.body,
        });
        this.updated += 1;
        this.didUpdate(templates);
      }
    }
  }
}
