import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const pages = require('../../../../src/tools/auth0/handlers/pages');
const { default: PagesHandler } = require('../../../../src/tools/auth0/handlers/pages');
const { mockPagedData } = require('../../../utils');

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

  return s;
}

describe('#pages handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_DRY_RUN: false,
  };

  describe('#pages process', () => {
    it('should update login page', async () => {
      const auth0 = {
        clients: {
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.client_id).to.equal('global1');
            expect(data.custom_login_page).to.equal('login_body');
            expect(data.custom_login_page_on).to.equal(true);
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'clients', [{ client_id: 'global1' }]),
        },
      };

      const handler = new pages.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { pages: [{ name: 'login', html: 'login_body', enabled: true }] },
      ]);
    });

    it('should get pages', async () => {
      const html = '<html>custom login page</html>';
      const errorPageUrl = 'https://mycompany.org/error';

      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              {
                name: 'Global Client',
                client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV',
                custom_login_page_on: true,
                custom_login_page: html,
              },
            ]),
        },
        tenants: {
          getSettings: () => ({
            data: {
              guardian_mfa_page: { enabled: true, html: html },
              change_password: { enabled: true, html: html },
              error_page: { show_log_link: true, html: html, url: errorPageUrl },
            },
          }),
        },
      };

      const handler = new pages.default({ client: pageClient(auth0) });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { enabled: true, html: html, name: 'login' },
        { enabled: true, html: html, name: 'guardian_multifactor' },
        { enabled: true, html: html, name: 'password_reset' },
        {
          show_log_link: true,
          html: html,
          url: errorPageUrl,
          name: 'error_page',
        },
      ]);
    });

    it('should update password_reset page', async () => {
      const auth0 = {
        tenants: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.change_password).to.be.an('object');
            expect(data.change_password.html).to.equal('password_reset_body');
            expect(data.change_password.enabled).to.equal(false);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new pages.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { pages: [{ name: 'password_reset', html: 'password_reset_body', enabled: false }] },
      ]);
    });

    it('should update error_page page', async () => {
      const errorPageHtml = '<html>error_page_body</html>';
      const errorPageUrl = 'https://mycompany.org/error';
      const auth0 = {
        tenants: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.error_page).to.be.an('object');
            expect(data.error_page.html).to.equal(errorPageHtml);
            expect(data.error_page.url).to.equal(errorPageUrl);
            expect(data.error_page.show_log_link).to.equal(true);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new pages.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          pages: [
            {
              name: 'error_page',
              html: errorPageHtml,
              show_log_link: true,
              url: errorPageUrl,
            },
          ],
        },
      ]);
    });
  });

  describe('#pages dryRunChanges', () => {
    let handler;
    let stageFn;
    let contextDataMock;

    const dryRunConfig = (key) => {
      if (key === 'AUTH0_DRY_RUN') return true;
      return dryRunConfig.data && dryRunConfig.data[key];
    };
    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    beforeEach(() => {
      contextDataMock = {
        pages: [
          { name: 'login', html: '<html>New Login</html>', enabled: true },
          { name: 'error_page', html: '<html>New Error</html>', enabled: false },
        ],
      };

      stageFn = (params) => {
        const { repository, mappings } = params;
        if (repository && mappings) {
          return contextDataMock;
        }
        return {};
      };

      handler = new pages.default({
        client: pageClient({
          clients: {
            getAll: (params) =>
              mockPagedData(params, 'clients', [
                {
                  client_id: 'global1',
                  custom_login_page: '<html>Old Login</html>',
                  custom_login_page_on: false,
                },
              ]),
          },
          tenants: {
            getSettings: () => ({
              data: {
                change_password: { enabled: true, html: '<html>Password Reset</html>' },
              },
            }),
          },
        }),
        config: dryRunConfig,
        stageFn,
      });

      handler.existing = [
        { name: 'login', html: '<html>Old Login</html>', enabled: false },
        { name: 'password_reset', html: '<html>Password Reset</html>', enabled: true },
      ];
    });

    it('should return create changes for new pages', async () => {
      contextDataMock.pages = [{ name: 'new_page', html: '<html>New Page</html>', enabled: true }];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1);
      expect(changes.update).to.have.length(1); // Existing pages get updated in the comparison
      expect(changes.del).to.have.length(2); // Existing pages not in assets get deleted
      expect(changes.conflicts).to.have.length(0);
      expect(changes.create[0].name).to.equal('new_page');
    });

    it('should return update changes for existing pages with differences', async () => {
      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1); // error_page is new
      expect(changes.update).to.have.length(2); // Both login and existing pages get updated
      expect(changes.del).to.have.length(1); // password_reset not in assets gets deleted
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for pages not in assets', async () => {
      contextDataMock.pages = []; // Empty pages array

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(2); // Both existing pages will be deleted
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when pages are identical', async () => {
      contextDataMock.pages = [
        { name: 'login', html: '<html>Old Login</html>', enabled: false },
        { name: 'password_reset', html: '<html>Password Reset</html>', enabled: true },
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed create, update, and delete operations', async () => {
      contextDataMock.pages = [
        { name: 'login', html: '<html>Updated Login</html>', enabled: true }, // Update
        { name: 'new_page', html: '<html>Brand New</html>', enabled: false }, // Create
        // password_reset will be deleted
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1);
      expect(changes.update).to.have.length(2); // Both items in array get processed as updates
      expect(changes.del).to.have.length(1);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const changes = await handler.dryRunChanges({});

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });

  describe('#pages processChanges dryrun tests', () => {
    it('should update pages during dry run without making API calls', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      // Mock getType to return existing pages
      handler.getType = stub().returns(
        Promise.resolve([{ name: 'login', html: '<html>Old Login</html>', enabled: false }])
      );

      const assets = {
        pages: [{ name: 'login', html: '<html>New Login</html>', enabled: true }],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(1);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });

    it('should not update identical pages during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      // Mock getType to return existing pages
      handler.getType = stub().returns(
        Promise.resolve([{ name: 'login', html: '<html>Same Login</html>', enabled: true }])
      );

      const assets = {
        pages: [{ name: 'login', html: '<html>Same Login</html>', enabled: true }],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });

    it('should handle multiple page updates during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      // Mock getType to return existing pages
      handler.getType = stub().returns(
        Promise.resolve([
          { name: 'login', html: '<html>Old Login</html>', enabled: false },
          { name: 'password_reset', html: '<html>Old Reset</html>', enabled: false },
        ])
      );

      const assets = {
        pages: [
          { name: 'login', html: '<html>New Login</html>', enabled: true },
          { name: 'password_reset', html: '<html>New Reset</html>', enabled: true },
        ],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(2);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });

    it('should create new pages during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      // Mock getType to return empty existing pages
      handler.getType = stub().returns(Promise.resolve([]));

      const assets = {
        pages: [{ name: 'login', html: '<html>New Login</html>', enabled: true }],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(1);
      expect(handler.deleted).to.equal(0);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });

    it('should delete pages during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      // Mock getType to return existing pages that will be deleted
      handler.getType = stub().returns(
        Promise.resolve([{ name: 'login', html: '<html>Old Login</html>', enabled: false }])
      );

      const assets = {
        pages: [], // Empty means delete all
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(1);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });

    it('should handle no pages config during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        tenantSettings: {
          update: stub().returns(
            Promise.reject(new Error('tenantSettings.update should not have been called'))
          ),
        },
        clients: {
          update: stub().returns(
            Promise.reject(new Error('clients.update should not have been called'))
          ),
          getAll: stub().returns(Promise.resolve({ data: [{ client_id: 'global1' }] })),
        },
        customDomains: {
          getAll: stub().returns(Promise.resolve({ data: [] })),
        },
      };

      const handler = new PagesHandler({ client: auth0, config: (key) => dryRunConfig[key] });
      const assets = {};

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.tenantSettings.update.called).to.equal(false);
      expect(auth0.clients.update.called).to.equal(false);
    });
  });
});
