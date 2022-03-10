const { expect } = require('chai');
const branding = require('../../../../src/tools/auth0/handlers/branding');

const html = '<html></html>';

describe('#branding handler', () => {
  describe('#branding process', () => {
    it('should get branding settings if no custom domain configured', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            logo_url: 'https://example.com/logo.png'
          }),
          getUniversalLoginTemplate: () => ({
            body: html
          })
        },
        customDomains: {
          getAll: () => [] // mock no custom domains
        }
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png'
      });
    });

    it('should get branding settings and templates if custom domain configured', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            logo_url: 'https://example.com/logo.png'
          }),
          getUniversalLoginTemplate: () => ({
            body: html
          })
        },
        customDomains: {
          getAll: () => [
            {} // mock one custom domain.
          ]
        }
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png',
        templates: [
          {
            template: 'universal_login',
            body: html
          }
        ]
      });
    });

    it('should return no templates if HTTP 403 error fetching custom domains', async () => {
      const auth0 = {
        branding: {
          getSettings: () => ({
            logo_url: 'https://example.com/logo.png'
          }),
          getUniversalLoginTemplate: () => ({
            body: html
          })
        },
        customDomains: {
          getAll: () => {
            const err = new Error('FakeHttpError');
            err.statusCode = 403;
            return Promise.reject(err);
          }
        }
      };

      const handler = new branding.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        logo_url: 'https://example.com/logo.png'
      });
    });

    it('should update branding settings without templates if no templates set', (done) => {
      const auth0 = {
        branding: {
          updateSettings: (params, data) => {
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
          }
        }
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      stageFn.apply(handler, [
        {
          branding: {
            logo_url: 'https://example.com/logo.png'
          }
        }
      ]);
    });

    it('should update branding settings and templates if templates set', (done) => {
      const auth0 = {
        branding: {
          updateSettings: (params, data) => {
            try {
              expect(data).to.be.an('object');
              expect(data.templates).to.equal(undefined);
              expect(data.logo_url).to.equal('https://example.com/logo.png');
            } catch (err) {
              done(err);
            }
          },
          setUniversalLoginTemplate: (params, data) => {
            try {
              expect(data).to.be.an('object');
              expect(data.template).to.equal(html);
              done();
            } catch (err) {
              done(err);
            }
          }
        }
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
                body: html
              }
            ]
          }
        }
      ]);
    });

    it('should not throw, and be no-op if branding not set in context', async () => {
      const auth0 = {
        branding: {
          updateSettings: () => {
            throw new Error('updateSettings should not have been called.');
          },
          setUniversalLoginTemplate: () => {
            throw new Error('setUniversalLoginTemplate should not have been called.');
          }
        }
      };

      const handler = new branding.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          // don't include branding prop.
        }
      ]);
    });
  });
});
