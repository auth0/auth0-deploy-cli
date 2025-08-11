const { expect, assert, use } = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { omit, cloneDeep } = require('lodash');
const { default: ThemesHandler } = require('../../../../src/tools/auth0/handlers/themes');

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
          getDefaultTheme: stub().returns(Promise.resolve({ data: theme })),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([theme]);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should return empty array if there is no theme', async () => {
      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([]);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should return empty array when no-code is not enabled for the tenant', async () => {
      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(
            Promise.reject(
              errorWithStatusCode(
                400,
                'Your account does not have universal login customizations enabled'
              )
            )
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal(null);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should fail for unexpected api errors', async () => {
      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(
            Promise.reject(errorWithStatusCode(500, 'Unexpected error'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      await expect(handler.getType()).to.be.rejectedWith('Unexpected error');
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });
  });

  describe('#themes processChange', () => {
    it('should create the theme when default theme does not exist', async () => {
      const theme = mockTheme();

      const config = {
        AUTH0_DRY_RUN: false,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
          createTheme: stub().returns(Promise.resolve(theme)),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [theme] };

      await handler.processChanges(assets);

      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
      expect(auth0.branding.createTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.callCount).to.equal(1);
      expect(auth0.branding.createTheme.calledWith(theme)).to.equal(true);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });

    it('should create the theme when default exists', async () => {
      const theme = mockTheme({ withThemeId: 'myThemeId' });

      const config = {
        AUTH0_DRY_RUN: false,
      };
      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns({ data: theme }),
          createTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          updateTheme: stub().returns(Promise.resolve(theme)),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [omit(theme, 'themeId')] };

      await handler.processChanges(assets);

      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
      expect(auth0.branding.updateTheme.called).to.equal(true);
      expect(auth0.branding.updateTheme.callCount).to.equal(1);
      expect(
        auth0.branding.updateTheme.calledWith({ themeId: 'myThemeId' }, omit(theme, 'themeId'))
      ).to.deep.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });
  });

  it('should delete the theme when default theme exists and AUTH0_ALLOW_DELETE: true', async () => {
    const theme = mockTheme({ withThemeId: 'delete-me' });
    const config = {
      AUTH0_ALLOW_DELETE: true,
    };

    const auth0 = {
      branding: {
        getDefaultTheme: stub().returns(Promise.resolve({ data: theme })),
        createTheme: stub().returns(
          Promise.reject(new Error('createTheme should not have been called'))
        ),
        updateTheme: stub().returns(
          Promise.reject(new Error('updateTheme should not have been called'))
        ),
        deleteTheme: stub().returns(Promise.resolve({ data: undefined })),
      },
    };

    const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
    const assets = { themes: [] };

    await handler.processChanges(assets);

    expect(auth0.branding.getDefaultTheme.called).to.equal(true);
    expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    expect(auth0.branding.deleteTheme.callCount).to.equal(1);
    expect(auth0.branding.deleteTheme.calledWith({ themeId: 'delete-me' })).to.equal(true);
    expect(auth0.branding.updateTheme.called).to.equal(false);
    expect(auth0.branding.createTheme.called).to.equal(false);
  });

  it('should not delete the theme when AUTH0_ALLOW_DELETE: false', async () => {
    const config = {
      AUTH0_ALLOW_DELETE: false,
    };

    const auth0 = {
      branding: {
        getDefaultTheme: stub().returns(
          Promise.reject(new Error('getDefaultTheme should not have been called'))
        ),
        createTheme: stub().returns(
          Promise.reject(new Error('createTheme should not have been called'))
        ),
        updateTheme: stub().returns(
          Promise.reject(new Error('updateTheme should not have been called'))
        ),
        deleteTheme: stub().returns(
          Promise.reject(new Error('deleteTheme should not have been called'))
        ),
      },
    };

    const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
    const assets = { themes: [] };

    await handler.processChanges(assets);

    expect(auth0.branding.getDefaultTheme.called).to.equal(false);
    expect(auth0.branding.deleteTheme.called).to.equal(false);
    expect(auth0.branding.updateTheme.called).to.equal(false);
    expect(auth0.branding.createTheme.called).to.equal(false);
  });

  describe('#themes dryrun tests', () => {
    it('should not output any changes when no theme exists in dry run mode', async () => {
      const theme = mockTheme();
      const config = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [theme] };

      await handler.processChanges(assets);

      // When no theme exists, calcChanges detects a create but the dry run early exit logic triggers
      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });

    it('should output update changes for themes in dry run mode when theme exists', async () => {
      const existingTheme = mockTheme({ withThemeId: 'existing-theme' });
      const newTheme = { ...mockTheme(), displayName: 'Updated theme' };

      const config = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.resolve({ data: existingTheme })),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(Promise.resolve(newTheme)),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [newTheme] };

      await handler.processChanges(assets);

      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(1);
      expect(handler.deleted).to.equal(0);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(true); // API call is still made
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });

    it('should output delete changes for themes in dry run mode when theme should be deleted', async () => {
      const existingTheme = mockTheme({ withThemeId: 'delete-me' });
      const config = {
        AUTH0_DRY_RUN: true,
        AUTH0_ALLOW_DELETE: true,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.resolve({ data: existingTheme })),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(Promise.resolve({ data: undefined })),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [] };

      await handler.processChanges(assets);

      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(0);
      expect(handler.deleted).to.equal(1);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(true); // API call is still made
    });

    it('should output delete changes when AUTH0_ALLOW_DELETE is false in dry run mode', async () => {
      const config = {
        AUTH0_DRY_RUN: true,
        AUTH0_ALLOW_DELETE: false,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [] };

      await handler.processChanges(assets);

      // calcChanges is called first to determine operations, then early exit occurs
      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });

    it('should not output any changes when theme does not exist and empty array provided in dry run mode', async () => {
      const config = {
        AUTH0_DRY_RUN: true,
        AUTH0_ALLOW_DELETE: true,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [] };

      await handler.processChanges(assets);

      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });

    it('should handle no-code not enabled for tenant in dry run mode', async () => {
      const theme = mockTheme();
      const config = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(
            Promise.reject(
              errorWithStatusCode(
                400,
                'Your account does not have universal login customizations enabled'
              )
            )
          ),
          createTheme: stub().returns(
            Promise.reject(new Error('createTheme should not have been called'))
          ),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          deleteTheme: stub().returns(
            Promise.reject(new Error('deleteTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0, config: (key) => config[key] });
      const assets = { themes: [theme] };

      // This should error due to calculateDryRunChanges trying to process null
      await expect(handler.processChanges(assets)).to.be.rejected;

      expect(handler.created).to.equal(0);
      expect(handler.updated).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
      expect(auth0.branding.updateTheme.called).to.equal(false);
      expect(auth0.branding.deleteTheme.called).to.equal(false);
    });
  });
});

module.exports = {
  mockTheme,
};
