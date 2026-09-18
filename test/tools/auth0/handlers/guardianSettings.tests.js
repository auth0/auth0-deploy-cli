const { expect } = require('chai');
const guardianSettings = require('../../../../src/tools/auth0/handlers/guardianSettings');

const SETTINGS = {
  display_remember_me_checkbox: true,
  remember_me_default_value: false,
  mfa_session_inactivity_timeout: 604800,
  mfa_session_overall_timeout: 2592000,
};

describe('#guardianSettings handler', () => {
  describe('#getType', () => {
    it('should support older version of auth0 client (404)', async () => {
      const auth0 = {
        guardian: {
          get: () => {
            const err = new Error('Not Found');
            err.statusCode = 404;
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should support when endpoint is disabled for tenant (403)', async () => {
      const auth0 = {
        guardian: {
          get: () => {
            const err = new Error('This endpoint is disabled for your tenant.');
            err.statusCode = 403;
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should get guardian settings', async () => {
      const auth0 = {
        guardian: {
          get: () => Promise.resolve({ ...SETTINGS }),
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(SETTINGS);
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        guardian: {
          get: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      try {
        await handler.getType();
        throw new Error('Expected getType to throw');
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.statusCode).to.equal(500);
      }
    });
  });

  describe('#processChanges', () => {
    it('should update guardian settings', async () => {
      let called = false;
      const auth0 = {
        guardian: {
          set: (data) => {
            called = true;
            expect(data).to.eql(SETTINGS);
            return Promise.resolve(data);
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianSettings: { ...SETTINGS } }]);
      expect(called).to.equal(true);
      expect(handler.updated).to.equal(1);
    });

    it('should skip processing if assets are empty', async () => {
      const auth0 = {
        guardian: {
          set: () => Promise.reject(new Error('set() should not have been called')),
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianSettings: null }]);
      expect(handler.updated).to.equal(0);
    });

    it('should warn and skip when the feature is not allowed on the tenant (403)', async () => {
      const auth0 = {
        guardian: {
          set: () => {
            const err = new Error('This endpoint is disabled for your tenant.');
            err.statusCode = 403;
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // Should resolve (not throw) even though the API rejects with a 403.
      await stageFn.apply(handler, [{ guardianSettings: { ...SETTINGS } }]);
      expect(handler.updated).to.equal(0);
    });

    it('should not write when in dry-run mode and there are no changes', async () => {
      const auth0 = {
        guardian: {
          get: () => Promise.resolve({ ...SETTINGS }),
          set: () => Promise.reject(new Error('set() should not be called during dry-run')),
        },
      };

      const config = (key) => (key === 'AUTH0_DRY_RUN' ? true : null);
      const handler = new guardianSettings.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianSettings: { ...SETTINGS } }]);
      expect(handler.updated).to.equal(0);
    });

    it('should write when there are changes in dry-run apply-after-preview mode', async () => {
      // processChanges is only reached in dry-run when the user opts to apply after
      // preview (AUTH0_DRY_RUN_APPLY / interactive "Apply changes"), where AUTH0_DRY_RUN
      // is still set. In that flow a changed value should be written.
      let called = false;
      const changed = { ...SETTINGS, mfa_session_overall_timeout: 1209600 };
      const auth0 = {
        guardian: {
          get: () => Promise.resolve({ ...SETTINGS }),
          set: (data) => {
            called = true;
            expect(data).to.eql(changed);
            return Promise.resolve(data);
          },
        },
      };

      const config = (key) => (key === 'AUTH0_DRY_RUN' ? true : null);
      const handler = new guardianSettings.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianSettings: { ...changed } }]);
      expect(called).to.equal(true);
      expect(handler.updated).to.equal(1);
    });

    it('should rethrow errors that are not feature-unavailable/forbidden', async () => {
      const auth0 = {
        guardian: {
          set: () => {
            const err = new Error('Internal Server Error');
            err.statusCode = 500;
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ guardianSettings: { ...SETTINGS } }]);
        throw new Error('Expected processChanges to throw');
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.statusCode).to.equal(500);
      }
      expect(handler.updated).to.equal(0);
    });
  });
});
