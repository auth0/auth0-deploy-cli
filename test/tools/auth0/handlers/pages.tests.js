const { expect } = require('chai');
const pages = require('../../../../src/tools/auth0/handlers/pages');

describe('#pages handler', () => {
  describe('#pages process', () => {
    it('should update login page', async () => {
      const auth0 = {
        clients: {
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.client_id).to.equal('global1');
            expect(data.custom_login_page).to.equal('login_body');
            expect(data.custom_login_page_on).to.equal(true);
            return Promise.resolve(data);
          },
          getAll: () => [ { client_id: 'global1' } ]
        }
      };

      const handler = new pages.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { pages: [ { name: 'login', html: 'login_body', enabled: true } ] } ]);
    });

    it('should get pages', async () => {
      const html = '<html>custom login page</html>';
      const errorPageUrl = 'https://mycompany.org/error';

      const auth0 = {
        clients: {
          getAll: () => [
            {
              name: 'Global Client',
              client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV',
              custom_login_page_on: true,
              custom_login_page: html
            }
          ]
        },
        tenant: {
          getSettings: () => ({
            guardian_mfa_page: { enabled: true, html: html },
            change_password: { enabled: true, html: html },
            error_page: { show_log_link: true, html: html, url: errorPageUrl }
          })
        }
      };

      const handler = new pages.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { enabled: true, html: html, name: 'login' },
        { enabled: true, html: html, name: 'guardian_multifactor' },
        { enabled: true, html: html, name: 'password_reset' },
        {
          show_log_link: true,
          html: html,
          url: errorPageUrl,
          name: 'error_page'
        }
      ]);
    });

    it('should update password_reset page', async () => {
      const auth0 = {
        tenant: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.change_password).to.be.an('object');
            expect(data.change_password.html).to.equal('password_reset_body');
            expect(data.change_password.enabled).to.equal(false);
            return Promise.resolve(data);
          }
        }
      };

      const handler = new pages.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { pages: [ { name: 'password_reset', html: 'password_reset_body', enabled: false } ] } ]);
    });

    it('should update error_page page', async () => {
      const errorPageHtml = '<html>error_page_body</html>';
      const errorPageUrl = 'https://mycompany.org/error';
      const auth0 = {
        tenant: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.error_page).to.be.an('object');
            expect(data.error_page.html).to.equal(errorPageHtml);
            expect(data.error_page.url).to.equal(errorPageUrl);
            expect(data.error_page.show_log_link).to.equal(true);
            return Promise.resolve(data);
          }
        }
      };

      const handler = new pages.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          pages: [
            {
              name: 'error_page',
              html: errorPageHtml,
              show_log_link: true,
              url: errorPageUrl
            }
          ]
        }
      ]);
    });
  });
});
