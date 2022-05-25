import { cloneDeep } from 'lodash';
import { Assets } from '../../../types';
import log from '../../../logger';
import DefaultHandler from './default';

export default class ThemesHandler extends DefaultHandler {
  existing: ThemeRequest[] | null;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'themes',
    });
  }

  async getType(): Promise<ThemeRequest[] | null> {
    if (!this.existing) {
      this.existing = await this.getThemes();
    }

    return this.existing;
  }

  async getThemes(): Promise<ThemeRequest[] | null> {
    let theme;

    try {
      theme = await this.client.branding.getDefaultTheme();
    } catch (err) {
      // Errors other than 404 (theme doesn't exist) or 400 (no-code not enabled) shouldn't be expected
      if (err.statusCode !== 404 && err.statusCode !== 400) {
        throw err;
      }
    }

    if (theme) {
      delete theme.themeId;
      return [theme];
    }

    return null;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { themes } = assets;

    if (!themes || themes.length === 0) {
      return;
    }

    if (themes.length > 1) {
      log.warn('Only one theme is supported per tenant');
    }

    let themeId: string = '';
    try {
      const theme = await this.client.branding.getDefaultTheme();
      themeId = theme.themeId;
    } catch (err) {
      // error 404 is expected, the tenant may not have a default theme
      if (err.statusCode !== 404) {
        throw err;
      }
    }

    // if theme exists, overwrite it otherwise create it
    if (themeId) {
      await this.client.branding.updateTheme({ id: themeId }, themes[0]);
    } else {
      await this.client.branding.createTheme(themes[0]);
    }

    this.updated += 1;
    this.didUpdate(themes[0]);
  }
}

/**
 * Schema
 */
export const schema = {
  type: 'array',
  items: {
    additionalProperties: false,
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

/**
 * Utility types
 */

export interface Colors {
  primary_button: string;
  primary_button_label: string;
  secondary_button_border: string;
  secondary_button_label: string;
  links_focused_components: string;
  header: string;
  body_text: string;
  widget_background: string;
  widget_border: string;
  input_labels_placeholders: string;
  input_filled_text: string;
  input_border: string;
  input_background: string;
  icons: string;
  error: string;
  success: string;
  base_focus_color?: string;
  base_hover_color?: string;
}

export interface Fonts {
  font_url: string;
  reference_text_size: number;
  title: {
    size: number;
    bold: boolean;
  };
  subtitle: {
    size: number;
    bold: boolean;
  };
  body_text: {
    size: number;
    bold: boolean;
  };
  buttons_text: {
    size: number;
    bold: boolean;
  };
  input_labels: {
    size: number;
    bold: boolean;
  };
  links: {
    size: number;
    bold: boolean;
  };
  links_style: 'normal' | 'underlined';
}

export interface Borders {
  button_border_weight: number;
  buttons_style: 'sharp' | 'pill' | 'rounded';
  button_border_radius: number;
  input_border_weight: number;
  inputs_style: 'sharp' | 'pill' | 'rounded';
  input_border_radius: number;
  widget_corner_radius: number;
  widget_border_weight: number;
  show_widget_shadow: boolean;
}

export interface Widget {
  logo_position: 'left' | 'center' | 'right' | 'none';
  logo_url: string;
  logo_height: number;
  header_text_alignment: 'left' | 'center' | 'right';
  social_buttons_layout: 'top' | 'bottom';
}

export interface PageBackground {
  page_layout: 'left' | 'center' | 'right';
  background_color: string;
  background_image_url: string;
}

export interface Theme {
  colors: Colors;
  fonts: Fonts;
  borders: Borders;
  widget: Widget;
  page_background: PageBackground;
}

export interface ThemeRequest extends Theme {
  displayName?: string;
}

export interface ThemeResponse extends Theme {
  themeId: string;
  displayName: string;
}

export const validTheme = (): ThemeRequest => {
  return cloneDeep({
    borders: {
      button_border_radius: 1,
      button_border_weight: 1,
      buttons_style: 'pill',
      input_border_radius: 3,
      input_border_weight: 1,
      inputs_style: 'pill',
      show_widget_shadow: false,
      widget_border_weight: 1,
      widget_corner_radius: 3,
    },
    colors: {
      body_text: '#FF00CC',
      error: '#FF00CC',
      header: '#FF00CC',
      icons: '#FF00CC',
      input_background: '#FF00CC',
      input_border: '#FF00CC',
      input_filled_text: '#FF00CC',
      input_labels_placeholders: '#FF00CC',
      links_focused_components: '#FF00CC',
      primary_button: '#FF00CC',
      primary_button_label: '#FF00CC',
      secondary_button_border: '#FF00CC',
      secondary_button_label: '#FF00CC',
      success: '#FF00CC',
      widget_background: '#FF00CC',
      widget_border: '#FF00CC',
    },
    fonts: {
      body_text: {
        bold: false,
        size: 100,
      },
      buttons_text: {
        bold: false,
        size: 100,
      },
      font_url: 'https://google.com/font.woff',
      input_labels: {
        bold: false,
        size: 100,
      },
      links: {
        bold: false,
        size: 100,
      },
      links_style: 'normal',
      reference_text_size: 12,
      subtitle: {
        bold: false,
        size: 100,
      },
      title: {
        bold: false,
        size: 100,
      },
    },
    page_background: {
      background_color: '#000000',
      background_image_url: 'https://google.com/background.png',
      page_layout: 'center',
    },
    widget: {
      header_text_alignment: 'center',
      logo_height: 55,
      logo_position: 'center',
      logo_url: 'https://google.com/logo.png',
      social_buttons_layout: 'top',
    },
    displayName: 'Default theme',
  });
};
