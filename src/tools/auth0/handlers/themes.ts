import { PostBrandingTheme200Response } from 'auth0';
import { Assets } from '../../../types';
import log from '../../../logger';
import DefaultHandler, { order } from './default';

export type Theme = PostBrandingTheme200Response
export default class ThemesHandler extends DefaultHandler {
  existing: Theme[] | null;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'themes',
      id: 'themeId',
    });
  }

  objString(theme: Theme): string {
    return theme.displayName || JSON.stringify(theme);
  }

  async getType(): Promise<Theme[] | null> {
    if (!this.existing) {
      this.existing = await this.getThemes();
    }

    return this.existing;
  }

  @order('60') // Run after custom domains.
  async processChanges(assets: Assets): Promise<void> {
    const { themes } = assets;

    // Non existing section means themes doesn't need to be processed
    if (!themes) {
      return;
    }

    // Empty array means themes should be deleted
    if (themes.length === 0) {
      return this.deleteThemes();
    }

    return this.updateThemes(themes);
  }

  async deleteThemes(): Promise<void> {
    if (!this.config('AUTH0_ALLOW_DELETE')) {
      return;
    }

    // if theme exists we need to delete it
    const currentThemes = await this.getThemes();
    if (currentThemes === null || currentThemes.length === 0) {
      return;
    }

    const currentTheme = currentThemes[0];
    await this.client.branding.deleteTheme({ themeId: currentTheme.themeId });

    this.deleted += 1;
    this.didDelete(currentTheme);
  }

  async updateThemes(themes: Theme[]): Promise<void> {
    if (themes.length > 1) {
      log.warn('Only one theme is supported per tenant');
    }

    const currentThemes = await this.getThemes();

    const themeReqPayload = ((): Omit<Theme, 'themeId'> => {
      // Removing themeId from update and create payloads, otherwise API will error
      // Theme ID may be required to handle if `--export_ids=true`
      const payload = themes[0];
      //@ts-ignore to quell non-optional themeId property, but we know that it's ok to delete
      delete payload.themeId;
      return payload;
    })();

    if (currentThemes === null || currentThemes.length === 0) {
      await this.client.branding.createTheme(themeReqPayload);
    } else {
      const currentTheme = currentThemes[0];
      // if theme exists, overwrite it otherwise create it
      await this.client.branding.updateTheme({ themeId: currentTheme.themeId }, themeReqPayload);
    }

    this.updated += 1;
    this.didUpdate(themes[0]);
  }

  async getThemes(): Promise<Theme[] | null> {
    try {
      const { data: theme } = await this.client.branding.getDefaultTheme();
      return [theme];
    } catch (err) {
      if (err.statusCode === 404) return [];
      if (err.statusCode === 400) return null;

      // Errors other than 404 (theme doesn't exist) or 400 (no-code not enabled) shouldn't be expected
      throw err;
    }
  }
}

/**
 * Schema
 */
export const schema = {
  type: 'array',
  items: {
    additionalProperties: true,
    properties: {
      borders: {
        additionalProperties: false,
        properties: {
          button_border_radius: {
            description: 'Button border radius',
            maximum: 10,
            minimum: 1,
            type: 'number',
          },
          button_border_weight: {
            description: 'Button border weight',
            maximum: 10,
            minimum: 0,
            type: 'number',
          },
          buttons_style: {
            description: 'Buttons style',
            enum: ['pill', 'rounded', 'sharp'],
            type: 'string',
          },
          input_border_radius: {
            description: 'Input border radius',
            maximum: 10,
            minimum: 0,
            type: 'number',
          },
          input_border_weight: {
            description: 'Input border weight',
            maximum: 3,
            minimum: 0,
            type: 'number',
          },
          inputs_style: {
            description: 'Inputs style',
            enum: ['pill', 'rounded', 'sharp'],
            type: 'string',
          },
          show_widget_shadow: {
            description: 'Show widget shadow',
            type: 'boolean',
          },
          widget_border_weight: {
            description: 'Widget border weight',
            maximum: 10,
            minimum: 0,
            type: 'number',
          },
          widget_corner_radius: {
            description: 'Widget corner radius',
            maximum: 50,
            minimum: 0,
            type: 'number',
          },
        },
        required: [
          'button_border_radius',
          'button_border_weight',
          'buttons_style',
          'input_border_radius',
          'input_border_weight',
          'inputs_style',
          'show_widget_shadow',
          'widget_border_weight',
          'widget_corner_radius',
        ],
        type: 'object',
      },
      colors: {
        additionalProperties: false,
        properties: {
          base_focus_color: {
            description: 'Base Focus Color',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          base_hover_color: {
            description: 'Base Hover Color',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          body_text: {
            description: 'Body text',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          captcha_widget_theme: {
            description: 'Captcha Widget Theme',
            pattern: '^(auto|light|dark)$',
            type: 'string',
          },
          error: {
            description: 'Error',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          header: {
            description: 'Header',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          icons: {
            description: 'Icons',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          input_background: {
            description: 'Input background',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          input_border: {
            description: 'Input border',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          input_filled_text: {
            description: 'Input filled text',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          input_labels_placeholders: {
            description: 'Input labels & placeholders',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          links_focused_components: {
            description: 'Links & focused components',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          primary_button: {
            description: 'Primary button',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          primary_button_label: {
            description: 'Primary button label',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          secondary_button_border: {
            description: 'Secondary button border',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          secondary_button_label: {
            description: 'Secondary button label',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          success: {
            description: 'Success',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          widget_background: {
            description: 'Widget background',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          widget_border: {
            description: 'Widget border',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
        },
        required: [
          'body_text',
          'error',
          'header',
          'icons',
          'input_background',
          'input_border',
          'input_filled_text',
          'input_labels_placeholders',
          'links_focused_components',
          'primary_button',
          'primary_button_label',
          'secondary_button_border',
          'secondary_button_label',
          'success',
          'widget_background',
          'widget_border',
          'captcha_widget_theme'
        ],
        type: 'object',
      },
      displayName: {
        description: 'Display Name',
        maxLength: 2048,
        pattern: '^[^<>]*$',
        type: 'string',
      },
      fonts: {
        additionalProperties: false,
        properties: {
          body_text: {
            additionalProperties: false,
            description: 'Body text',
            properties: {
              bold: {
                description: 'Body text bold',
                type: 'boolean',
              },
              size: {
                description: 'Body text size',
                maximum: 150,
                minimum: 0,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
          buttons_text: {
            additionalProperties: false,
            description: 'Buttons text',
            properties: {
              bold: {
                description: 'Buttons text bold',
                type: 'boolean',
              },
              size: {
                description: 'Buttons text size',
                maximum: 150,
                minimum: 0,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
          font_url: {
            description: 'Font URL',
            pattern:
              "^$|^(?=.)(?!https?:\\/(?:$|[^/]))(?!https?:\\/\\/\\/)(?!https?:[^/])(?:(?:https):(?:(?:\\/\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:]*@)?(?:\\[(?:(?:(?:[\\dA-Fa-f]{1,4}:){6}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|::(?:[\\dA-Fa-f]{1,4}:){5}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){4}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,1}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){3}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,2}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){2}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,3}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}:(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,4}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,5}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}|(?:(?:[\\dA-Fa-f]{1,4}:){0,6}[\\dA-Fa-f]{1,4})?::)|v[\\dA-Fa-f]+\\.[\\w-\\.~!\\$&'\\(\\)\\*\\+,;=:]+)\\]|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=]{1,255})(?::\\d*)?(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)|\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)?|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*|(?:\\/\\/\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)))(?:\\?[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*(?=#|$))?(?:#[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*)?$",
            type: 'string',
          },
          input_labels: {
            additionalProperties: false,
            description: 'Input Labels',
            properties: {
              bold: {
                description: 'Input Labels bold',
                type: 'boolean',
              },
              size: {
                description: 'Input Labels size',
                maximum: 150,
                minimum: 0,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
          links: {
            additionalProperties: false,
            description: 'Links',
            properties: {
              bold: {
                description: 'Links bold',
                type: 'boolean',
              },
              size: {
                description: 'Links size',
                maximum: 150,
                minimum: 0,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
          links_style: {
            description: 'Links style',
            enum: ['normal', 'underlined'],
            type: 'string',
          },
          reference_text_size: {
            description: 'Reference text size',
            maximum: 24,
            minimum: 12,
            type: 'number',
          },
          subtitle: {
            additionalProperties: false,
            description: 'Subtitle',
            properties: {
              bold: {
                description: 'Subtitle bold',
                type: 'boolean',
              },
              size: {
                description: 'Subtitle size',
                maximum: 150,
                minimum: 0,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
          title: {
            additionalProperties: false,
            description: 'Title',
            properties: {
              bold: {
                description: 'Title bold',
                type: 'boolean',
              },
              size: {
                description: 'Title size',
                maximum: 150,
                minimum: 75,
                type: 'number',
              },
            },
            required: ['bold', 'size'],
            type: 'object',
          },
        },
        required: [
          'body_text',
          'buttons_text',
          'font_url',
          'input_labels',
          'links',
          'links_style',
          'reference_text_size',
          'subtitle',
          'title',
        ],
        type: 'object',
      },
      page_background: {
        additionalProperties: false,
        properties: {
          background_color: {
            description: 'Background color',
            pattern: '^#(([0-9a-fA-F]{3}){1,2}|([0-9a-fA-F]{4}){1,2})$',
            type: 'string',
          },
          background_image_url: {
            description: 'Background image url',
            pattern:
              "^$|^(?=.)(?!https?:\\/(?:$|[^/]))(?!https?:\\/\\/\\/)(?!https?:[^/])(?:(?:https):(?:(?:\\/\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:]*@)?(?:\\[(?:(?:(?:[\\dA-Fa-f]{1,4}:){6}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|::(?:[\\dA-Fa-f]{1,4}:){5}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){4}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,1}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){3}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,2}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){2}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,3}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}:(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,4}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,5}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}|(?:(?:[\\dA-Fa-f]{1,4}:){0,6}[\\dA-Fa-f]{1,4})?::)|v[\\dA-Fa-f]+\\.[\\w-\\.~!\\$&'\\(\\)\\*\\+,;=:]+)\\]|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=]{1,255})(?::\\d*)?(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)|\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)?|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*|(?:\\/\\/\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)))(?:\\?[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*(?=#|$))?(?:#[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*)?$",
            type: 'string',
          },
          page_layout: {
            description: 'Page Layout',
            enum: ['center', 'left', 'right'],
            type: 'string',
          },
        },
        required: ['background_color', 'background_image_url', 'page_layout'],
        type: 'object',
      },
      widget: {
        additionalProperties: false,
        properties: {
          header_text_alignment: {
            description: 'Header text alignment',
            enum: ['center', 'left', 'right'],
            type: 'string',
          },
          logo_height: {
            description: 'Logo height',
            maximum: 100,
            minimum: 1,
            type: 'number',
          },
          logo_position: {
            description: 'Logo position',
            enum: ['center', 'left', 'none', 'right'],
            type: 'string',
          },
          logo_url: {
            description: 'Logo url',
            pattern:
              "^$|^(?=.)(?!https?:\\/(?:$|[^/]))(?!https?:\\/\\/\\/)(?!https?:[^/])(?:(?:https):(?:(?:\\/\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:]*@)?(?:\\[(?:(?:(?:[\\dA-Fa-f]{1,4}:){6}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|::(?:[\\dA-Fa-f]{1,4}:){5}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){4}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,1}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){3}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,2}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:){2}(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,3}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}:(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,4}[\\dA-Fa-f]{1,4})?::(?:[\\dA-Fa-f]{1,4}:[\\dA-Fa-f]{1,4}|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5]))|(?:(?:[\\dA-Fa-f]{1,4}:){0,5}[\\dA-Fa-f]{1,4})?::[\\dA-Fa-f]{1,4}|(?:(?:[\\dA-Fa-f]{1,4}:){0,6}[\\dA-Fa-f]{1,4})?::)|v[\\dA-Fa-f]+\\.[\\w-\\.~!\\$&'\\(\\)\\*\\+,;=:]+)\\]|(?:(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:0{0,2}\\d|0?[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=]{1,255})(?::\\d*)?(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)|\\/(?:[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)?|[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]+(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*|(?:\\/\\/\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*(?:\\/[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@]*)*)))(?:\\?[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*(?=#|$))?(?:#[\\w-\\.~%\\dA-Fa-f!\\$&'\\(\\)\\*\\+,;=:@\\/\\?]*)?$",
            type: 'string',
          },
          social_buttons_layout: {
            description: 'Social buttons layout',
            enum: ['bottom', 'top'],
            type: 'string',
          },
        },
        required: [
          'header_text_alignment',
          'logo_height',
          'logo_position',
          'logo_url',
          'social_buttons_layout',
        ],
        type: 'object',
      },
    },
    required: ['borders', 'colors', 'fonts', 'page_background', 'widget'],
    type: 'object',
  },
};
