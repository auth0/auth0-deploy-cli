const { expect, assert, use } = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { omit, cloneDeep } = require('lodash');
const { default: ThemesHandler } = require('../../../../src/tools/auth0/handlers/themes');
const { preserveKeywords } = require('../../../../src/keywordPreservation');

use(chaiAsPromised);

function stub() {
  const s = function (...args) {
    s.callCount += 1;
    s.calls.push(args);
    s.called = true;
    return s.returnValue;
  };

  s.called = false;
  s.callCount = 0;
  s.calls = [];
  s.returnValue = undefined;
  s.returns = (r) => {
    s.returnValue = r;
    return s;
  };
  s.calledWith = (...args) =>
    s.calls.some((p) => {
      try {
        assert.deepEqual(p, args);
        return true;
      } catch {
        return false;
      }
    });

  return s;
}

function errorWithStatusCode(statusCode, message) {
  const err = new Error(message || `Error ${statusCode}`);
  err.statusCode = statusCode;
  return err;
}

const mockTheme = ({ withThemeId } = {}) => {
  const theme = cloneDeep({
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
      captcha_widget_theme: 'auto',
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

  if (withThemeId) {
    theme.themeId = withThemeId;
  }

  return theme;
};

describe('#themes handler', () => {
  describe('#themes getType', () => {
    it('should get themes', async () => {
      const theme = mockTheme({ withThemeId: 'myThemeId' });

      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(Promise.resolve(theme)),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([theme]);
      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
    });

    it('should return empty array if there is no theme', async () => {
      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(Promise.reject(errorWithStatusCode(404))),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([]);
      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
    });

    it('should return empty array when no-code is not enabled for the tenant', async () => {
      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(
              Promise.reject(
                errorWithStatusCode(
                  400,
                  'Your account does not have universal login customizations enabled'
                )
              )
            ),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal(null);
      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
    });

    it('should fail for unexpected api errors', async () => {
      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(
              Promise.reject(errorWithStatusCode(500, 'Unexpected error'))
            ),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      await expect(handler.getType()).to.be.rejectedWith('Unexpected error');
      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
    });
  });

  describe('#themes processChange', () => {
    it('should create the theme when default theme does not exist', async () => {
      const theme = mockTheme();

      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(Promise.reject(errorWithStatusCode(404))),
            create: stub().returns(Promise.resolve(theme)),
            update: stub().returns(Promise.reject(new Error('update should not have been called'))),
            delete: stub().returns(Promise.reject(new Error('delete should not have been called'))),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const assets = { themes: [theme] };

      await handler.processChanges(assets);

      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
      expect(auth0.branding.themes.create.called).to.equal(true);
      expect(auth0.branding.themes.create.callCount).to.equal(1);
      expect(auth0.branding.themes.create.calledWith(theme)).to.equal(true);
      expect(auth0.branding.themes.update.called).to.equal(false);
      expect(auth0.branding.themes.delete.called).to.equal(false);
    });

    it('should create the theme when default exists', async () => {
      const theme = mockTheme({ withThemeId: 'myThemeId' });

      const auth0 = {
        branding: {
          themes: {
            getDefault: stub().returns(theme),
            create: stub().returns(Promise.reject(new Error('create should not have been called'))),
            update: stub().returns(Promise.resolve(theme)),
            delete: stub().returns(Promise.reject(new Error('delete should not have been called'))),
          },
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const assets = { themes: [omit(theme, 'themeId')] };

      await handler.processChanges(assets);

      expect(auth0.branding.themes.getDefault.called).to.equal(true);
      expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
      expect(auth0.branding.themes.update.called).to.equal(true);
      expect(auth0.branding.themes.update.callCount).to.equal(1);
      expect(
        auth0.branding.themes.update.calledWith('myThemeId', omit(theme, 'themeId'))
      ).to.deep.equal(true);
      expect(auth0.branding.themes.create.called).to.equal(false);
      expect(auth0.branding.themes.delete.called).to.equal(false);
    });
  });

  it('should delete the theme when default theme exists and AUTH0_ALLOW_DELETE: true', async () => {
    const theme = mockTheme({ withThemeId: 'delete-me' });
    const config = {
      AUTH0_ALLOW_DELETE: true,
    };

    const auth0 = {
      branding: {
        themes: {
          getDefault: stub().returns(Promise.resolve(theme)),
          create: stub().returns(Promise.reject(new Error('create should not have been called'))),
          update: stub().returns(Promise.reject(new Error('update should not have been called'))),
          delete: stub().returns(Promise.resolve(undefined)),
        },
      },
    };

    const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
    const assets = { themes: [] };

    await handler.processChanges(assets);

    expect(auth0.branding.themes.getDefault.called).to.equal(true);
    expect(auth0.branding.themes.getDefault.callCount).to.equal(1);
    expect(auth0.branding.themes.delete.callCount).to.equal(1);
    expect(auth0.branding.themes.delete.calledWith('delete-me')).to.equal(true);
    expect(auth0.branding.themes.update.called).to.equal(false);
    expect(auth0.branding.themes.create.called).to.equal(false);
  });

  it('should not delete the theme when AUTH0_ALLOW_DELETE: false', async () => {
    const config = {
      AUTH0_ALLOW_DELETE: false,
    };

    const auth0 = {
      branding: {
        themes: {
          getDefault: stub().returns(
            Promise.reject(new Error('getDefault should not have been called'))
          ),
          create: stub().returns(Promise.reject(new Error('create should not have been called'))),
          update: stub().returns(Promise.reject(new Error('update should not have been called'))),
          delete: stub().returns(Promise.reject(new Error('delete should not have been called'))),
        },
      },
    };

    const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
    const assets = { themes: [] };

    await handler.processChanges(assets);

    expect(auth0.branding.themes.getDefault.called).to.equal(false);
    expect(auth0.branding.themes.delete.called).to.equal(false);
    expect(auth0.branding.themes.update.called).to.equal(false);
    expect(auth0.branding.themes.create.called).to.equal(false);
  });
});

describe('#themes keyword preservation', () => {
  const CDN_URL = 'https://cdn.example.com';
  const themeId = 'my-theme-id';

  const localThemeWithKeywords = {
    themeId,
    fonts: { font_url: '##CDN_URL##/fonts/custom.woff2' },
    widget: { logo_url: '##CDN_URL##/logo.png' },
  };

  const remoteThemeWithResolvedUrls = {
    themeId,
    fonts: { font_url: `${CDN_URL}/fonts/custom.woff2` },
    widget: { logo_url: `${CDN_URL}/logo.png` },
  };

  it('should preserve keyword placeholders in theme fields when themeId is in handler identifiers', () => {
    const result = preserveKeywords({
      localAssets: { themes: [localThemeWithKeywords] },
      remoteAssets: { themes: [remoteThemeWithResolvedUrls] },
      keywordMappings: { CDN_URL },
      auth0Handlers: [{ id: 'themeId', identifiers: ['themeId'], type: 'themes' }],
    });

    expect(result.themes[0].fonts.font_url).to.equal('##CDN_URL##/fonts/custom.woff2');
    expect(result.themes[0].widget.logo_url).to.equal('##CDN_URL##/logo.png');
  });

  it('should preserve keyword placeholders in theme fields when themeId is absent from local file (default export without AUTH0_EXPORT_IDENTIFIERS)', () => {
    // Real-world scenario: exported with AUTH0_EXPORT_IDENTIFIERS: false (the default),
    // so themeId is stripped from the local file. Keyword preservation must still work
    // using displayName as a fallback identifier.
    const localThemeWithoutThemeId = {
      displayName: 'Default theme',
      fonts: { font_url: '##CDN_URL##/fonts/custom.woff2' },
      widget: { logo_url: '##CDN_URL##/logo.png' },
    };

    const remoteThemeWithThemeId = {
      themeId,
      displayName: 'Default theme',
      fonts: { font_url: `${CDN_URL}/fonts/custom.woff2` },
      widget: { logo_url: `${CDN_URL}/logo.png` },
    };

    const result = preserveKeywords({
      localAssets: { themes: [localThemeWithoutThemeId] },
      remoteAssets: { themes: [remoteThemeWithThemeId] },
      keywordMappings: { CDN_URL },
      auth0Handlers: [{ id: 'themeId', identifiers: ['themeId', 'displayName'], type: 'themes' }],
    });

    expect(result.themes[0].fonts.font_url).to.equal('##CDN_URL##/fonts/custom.woff2');
    expect(result.themes[0].widget.logo_url).to.equal('##CDN_URL##/logo.png');
  });

  it('should preserve keyword placeholders using index fallback when neither themeId nor displayName is in local file', () => {
    // The exact customer scenario: AUTH0_EXPORT_IDENTIFIERS defaults to false AND no displayName
    // is set on the theme. The local file has no identifier fields at all — only keyword markers.
    // The index-based fallback should still preserve the keywords.
    const localThemeNoIdentifiers = {
      fonts: { font_url: '##CDN_URL##/fonts/custom.woff2' },
      widget: { logo_url: '##CDN_URL##/logo.png' },
    };

    const remoteThemeWithThemeId = {
      themeId,
      fonts: { font_url: `${CDN_URL}/fonts/custom.woff2` },
      widget: { logo_url: `${CDN_URL}/logo.png` },
    };

    const result = preserveKeywords({
      localAssets: { themes: [localThemeNoIdentifiers] },
      remoteAssets: { themes: [remoteThemeWithThemeId] },
      keywordMappings: { CDN_URL },
      auth0Handlers: [{ id: 'themeId', identifiers: ['themeId', 'displayName'], type: 'themes' }],
    });

    expect(result.themes[0].fonts.font_url).to.equal('##CDN_URL##/fonts/custom.woff2');
    expect(result.themes[0].widget.logo_url).to.equal('##CDN_URL##/logo.png');
  });

  it('should NOT preserve keyword placeholders for unregistered array types (no identifiers configured)', () => {
    // When identifiers is empty, the handler has not registered this array type for preservation.
    // No index fallback should apply — raw remote values are returned unchanged.
    const result = preserveKeywords({
      localAssets: { themes: [localThemeWithKeywords] },
      remoteAssets: { themes: [remoteThemeWithResolvedUrls] },
      keywordMappings: { CDN_URL },
      auth0Handlers: [{ id: 'themeId', identifiers: [], type: 'themes' }],
    });

    expect(result.themes[0].fonts.font_url).to.equal(`${CDN_URL}/fonts/custom.woff2`);
    expect(result.themes[0].widget.logo_url).to.equal(`${CDN_URL}/logo.png`);
  });
});

module.exports = {
  mockTheme,
};
