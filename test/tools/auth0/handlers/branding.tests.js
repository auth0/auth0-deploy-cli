const { expect } = require('chai');
const branding = require('../../../../src/tools/auth0/handlers/branding');

const html = '<html></html>';

describe('#branding handler', () => {
  describe('#branding process', () => {
    it('should get branding settings if no custom domain configured', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            data: {
              logo_url: 'https://example.com/logo.png',
            },
          }),
          getUniversalLoginTemplate: () => ({
            body: html,
          }),
        },
        customDomains: {
          getAll: () => [], // mock no custom domains
        },
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png',
      });
    });

    it('should get branding settings and templates if custom domain configured', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            data: {
              logo_url: 'https://example.com/logo.png',
            },
          }),
          getUniversalLoginTemplate: () => ({
            data: {
              body: html,
            },
          }),
        },
        customDomains: {
          getAll: () => ({
            data: [
              {}, // mock one custom domain.
            ],
          }),
        },
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png',
        templates: [
          {
            template: 'universal_login',
            body: html,
          },
        ],
      });
    });

    it('should return no templates if HTTP 403 error fetching custom domains', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            data: {
              logo_url: 'https://example.com/logo.png',
            },
          }),
          getUniversalLoginTemplate: () => ({
            body: html,
          }),
        },
        customDomains: {
          getAll: () => {
            const err = new Error('FakeHttpError');
            err.statusCode = 403;
            return Promise.reject(err);
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png',
      });
    });

    it('should update branding settings without templates if no templates set', (done) => {
      const auth0 = {
        branding: {
          updateSettings: (data) => {
            try {
              expect(data).to.be.an('object');
              expect(data.templates).to.equal(undefined);
              expect(data.logo_url).to.equal('https://example.com/logo.png');
              done();
            } catch (err) {
              done(err);
            }
          },
          setUniversalLoginTemplate: () => {
            done(new Error('setUniversalLoginTemplate should not have been called.'));
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      stageFn.apply(handler, [
        {
          branding: {
            logo_url: 'https://example.com/logo.png',
          },
        },
      ]);
    });

    it('should update branding settings and templates if templates set', (done) => {
      const auth0 = {
        branding: {
          updateSettings: (data) => {
            try {
              expect(data).to.be.an('object');
              expect(data.templates).to.equal(undefined);
              expect(data.logo_url).to.equal('https://example.com/logo.png');
            } catch (err) {
              done(err);
            }
          },
          setUniversalLoginTemplate: (data) => {
            try {
              expect(data).to.be.an('object');
              expect(data.template).to.equal(html);
              done();
            } catch (err) {
              done(err);
            }
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      stageFn.apply(handler, [
        {
          branding: {
            logo_url: 'https://example.com/logo.png',
            templates: [
              {
                template: 'universal_login',
                body: html,
              },
            ],
          },
        },
      ]);
    });

    it('should ignore empty string `logo_url` during update', async () => {
      let wasUpdateCalled = false;

      const auth0 = {
        branding: {
          updateSettings: (data) => {
            expect(data).to.deep.equal({
              colors: {
                primary: '#F8F8F2',
                page_background: '#112',
              },
              font: {
                url: 'https://mycompany.org/font/myfont.ttf',
              },
            });
            expect(data.logo_url).to.be.undefined; // eslint-disable-line no-unused-expressions
            wasUpdateCalled = true;
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          branding: {
            logo_url: '', // Note the empty string
            colors: {
              primary: '#F8F8F2',
              page_background: '#112',
            },
            font: {
              url: 'https://mycompany.org/font/myfont.ttf',
            },
          },
        },
      ]);

      expect(wasUpdateCalled).to.equal(true);
    });

    it('should not send updateSettings request if empty object passed', async () => {
      let wasUpdateCalled = false;

      const auth0 = {
        branding: {
          updateSettings: () => {
            wasUpdateCalled = true;
            throw new Error(
              'updateSettings should not have been called because omitted `logo_url` means that no API request needs to be made.'
            );
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          branding: {},
        },
      ]);

      expect(wasUpdateCalled).to.equal(false);
    });

    it('should not throw, and be no-op if branding not set in context', async () => {
      const auth0 = {
        branding: {
          updateSettings: () => {
            throw new Error('updateSettings should not have been called.');
          },
          setUniversalLoginTemplate: () => {
            throw new Error('setUniversalLoginTemplate should not have been called.');
          },
        },
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          // don't include branding prop.
        },
      ]);
    });
  });
});
