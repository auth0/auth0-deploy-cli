const { expect, assert } = require('chai');
const { omit } = require('lodash');
const {
  default: ThemesHandler,
  validTheme,
} = require('../../../../src/tools/auth0/handlers/themes');

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

describe('#themes handler', () => {
  describe('#themes getType', () => {
    it('should get themes', async () => {
      const theme = validTheme();
      theme.themeId = 'myThemeId';

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.resolve(theme)),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([omit(theme, 'themeId')]);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should not fail when there is no theme', async () => {
      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.equal(null);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should not fail when no-code is not enabled for the tenant', async () => {
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

      expect(data).to.equal(null);
      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
    });

    it('should fail for unexpected errors', async () => {
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
      const theme = validTheme();

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(Promise.reject(errorWithStatusCode(404))),
          createTheme: stub().returns(Promise.resolve(theme)),
          updateTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const assets = { themes: [theme] };

      await handler.processChanges(assets);

      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
      expect(auth0.branding.createTheme.called).to.equal(true);
      expect(auth0.branding.createTheme.callCount).to.equal(1);
      expect(auth0.branding.createTheme.calledWith(theme)).to.equal(true);
      expect(auth0.branding.updateTheme.called).to.equal(false);
    });

    it('should create the theme when default exists', async () => {
      const theme = validTheme();
      theme.themeId = 'myThemeId';

      const auth0 = {
        branding: {
          getDefaultTheme: stub().returns(theme),
          createTheme: stub().returns(
            Promise.reject(new Error('updateTheme should not have been called'))
          ),
          updateTheme: stub().returns(Promise.resolve(theme)),
        },
      };

      const handler = new ThemesHandler({ client: auth0 });
      const assets = { themes: [omit(theme, 'themeId')] };

      await handler.processChanges(assets);

      expect(auth0.branding.getDefaultTheme.called).to.equal(true);
      expect(auth0.branding.getDefaultTheme.callCount).to.equal(1);
      expect(auth0.branding.updateTheme.called).to.equal(true);
      expect(auth0.branding.updateTheme.callCount).to.equal(1);
      expect(
        auth0.branding.updateTheme.calledWith({ id: theme.themeId }, omit(theme, 'themeId'))
      ).to.deep.equal(true);
      expect(auth0.branding.createTheme.called).to.equal(false);
    });
  });
});
