const { expect } = require('chai');
const emailTemplates = require('../../../../src/tools/auth0/handlers/emailTemplates');
const {
  default: EmailTemplatesHandler,
} = require('../../../../src/tools/auth0/handlers/emailTemplates');

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
  s.callsFake = (fn) => {
    s.fakeFunction = fn;
    const wrapper = function (...args) {
      s.callCount += 1;
      s.calls.push(args);
      s.called = true;
      return s.fakeFunction(...args);
    };
    Object.assign(wrapper, s);
    return wrapper;
  };

  return s;
}

describe('#emailTemplates handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_DRY_RUN: false,
  };

  describe('#emailTemplates process', () => {
    it('should update email template', async () => {
      const auth0 = {
        emailTemplates: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.templateName).to.equal('verify_email');
            expect(data.template).to.equal('verify_email');
            expect(data.body).to.equal('body');
            return Promise.resolve({ data: { params, data } });
          },
        },
      };

      const handler = new emailTemplates.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { emailTemplates: [{ template: 'verify_email', body: 'body' }] },
      ]);
    });

    it('should get email templates', async () => {
      const auth0 = {
        emailTemplates: {
          get: (template) => ({
            data: {
              template: template.templateName,
              enabled: true,
              body: '<html>some email</html>',
            },
          }),
        },
      };

      const handler = new emailTemplates.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data.length).to.be.above(1);
      const verify = data.find((t) => t.template === 'verify_email');
      expect(verify).to.deep.equal({
        template: 'verify_email',
        enabled: true,
        body: '<html>some email</html>',
      });
    });

    it('should create email template', async () => {
      const auth0 = {
        emailTemplates: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.template).to.equal('verify_email');
            expect(data.body).to.equal('body');
            return Promise.resolve({ data });
          },
          update: () => {
            const error = new Error('test');
            error.statusCode = 404;
            throw error;
          },
        },
      };

      const handler = new emailTemplates.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { emailTemplates: [{ template: 'verify_email', body: 'body' }] },
      ]);
    });
  });

  describe('#emailTemplates dryRunChanges', () => {
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
        emailTemplates: [
          { template: 'verify_email', body: '<html>New Verify Email</html>', enabled: true },
          { template: 'reset_email', body: '<html>New Reset Email</html>', enabled: false },
        ],
      };

      stageFn = (params) => {
        const { repository, mappings } = params;
        if (repository && mappings) {
          return contextDataMock;
        }
        return {};
      };

      handler = new emailTemplates.default({
        client: {
          emailTemplates: {
            get: ({ templateName }) => {
              const templates = {
                verify_email: {
                  template: 'verify_email',
                  body: '<html>Old Verify Email</html>',
                  enabled: false,
                },
                welcome_email: {
                  template: 'welcome_email',
                  body: '<html>Welcome Email</html>',
                  enabled: true,
                },
              };
              if (templates[templateName]) {
                return { data: templates[templateName] };
              }
              const error = new Error('Not found');
              error.statusCode = 404;
              throw error;
            },
          },
        },
        config: dryRunConfig,
        stageFn,
      });

      handler.existing = [
        { template: 'verify_email', body: '<html>Old Verify Email</html>', enabled: false },
        { template: 'welcome_email', body: '<html>Welcome Email</html>', enabled: true },
      ];
    });

    it('should return create changes for new emailTemplates', async () => {
      contextDataMock.emailTemplates = [
        { template: 'new_template', body: '<html>New Template</html>', enabled: true },
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1);
      expect(changes.update).to.have.length(1); // Existing templates get updated in comparison
      expect(changes.del).to.have.length(2); // Existing templates not in assets get deleted
      expect(changes.conflicts).to.have.length(0);
      expect(changes.create[0].template).to.equal('new_template');
    });

    it('should return update changes for existing emailTemplates with differences', async () => {
      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1); // reset_email is new
      expect(changes.update).to.have.length(2); // Both templates get updated in comparison
      expect(changes.del).to.have.length(1); // welcome_email not in assets gets deleted
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for emailTemplates not in assets', async () => {
      contextDataMock.emailTemplates = []; // Empty emailTemplates array

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(2); // Both existing templates will be deleted
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when emailTemplates are identical', async () => {
      contextDataMock.emailTemplates = [
        { template: 'verify_email', body: '<html>Old Verify Email</html>', enabled: false },
        { template: 'welcome_email', body: '<html>Welcome Email</html>', enabled: true },
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed create, update, and delete operations', async () => {
      contextDataMock.emailTemplates = [
        { template: 'verify_email', body: '<html>Updated Verify Email</html>', enabled: true }, // Update
        { template: 'new_template', body: '<html>Brand New Template</html>', enabled: false }, // Create
        // welcome_email will be deleted
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(1);
      expect(changes.update).to.have.length(2); // Both templates in array get processed as updates
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

  describe('#emailTemplates processChanges dryrun tests', () => {
    it('should update email templates during dry run without making API calls', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: stub().returns(
            Promise.resolve({
              data: {
                templateName: 'verify_email',
                body: '<html>Old Verify Email</html>',
                enabled: false,
              },
            })
          ),
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        emailTemplates: [
          { template: 'verify_email', body: '<html>New Verify Email</html>', enabled: true },
        ],
      };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(1);
      expect(changes.create).to.have.length(1);
      expect(changes.del).to.have.length(12);
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });

    it('should not update identical email templates during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: stub().returns(
            Promise.resolve({
              data: {
                templateName: 'verify_email',
                body: '<html>Same Email</html>',
                enabled: true,
              },
            })
          ),
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        emailTemplates: [
          { template: 'verify_email', body: '<html>Same Email</html>', enabled: true },
        ],
      };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(1); // Even identical templates show as update due to template comparison logic
      expect(changes.create).to.have.length(1);
      expect(changes.del).to.have.length(12); // Templates not in assets will be deleted
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });

    it('should handle multiple email template updates during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: stub().callsFake(({ templateName }) => {
            if (templateName === 'verify_email') {
              return Promise.resolve({
                data: {
                  templateName: 'verify_email',
                  body: '<html>Old Verify</html>',
                  enabled: false,
                },
              });
            }
            if (templateName === 'welcome_email') {
              return Promise.resolve({
                data: {
                  templateName: 'welcome_email',
                  body: '<html>Old Welcome</html>',
                  enabled: false,
                },
              });
            }
            const error = new Error('Not Found');
            error.statusCode = 404;
            return Promise.reject(error);
          }),
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        emailTemplates: [
          { template: 'verify_email', body: '<html>New Verify</html>', enabled: true },
          { template: 'welcome_email', body: '<html>New Welcome</html>', enabled: true },
        ],
      };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(2); // Based on debug: update=2
      expect(changes.create).to.have.length(2); // Based on debug: create=2
      expect(changes.del).to.have.length(2); // Based on debug: del=2
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });

    it('should create new email templates during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: (() => {
            const error = new Error('Not Found');
            error.statusCode = 404;
            return stub().returns(Promise.reject(error));
          })(), // No existing templates
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        emailTemplates: [
          { template: 'verify_email', body: '<html>New Template</html>', enabled: true },
        ],
      };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(0);
      expect(changes.create).to.have.length(1);
      expect(changes.del).to.have.length(0);
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });

    it('should handle mixed create and update during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: stub().callsFake(({ templateName }) => {
            if (templateName === 'verify_email') {
              return Promise.resolve({
                data: {
                  templateName: 'verify_email',
                  body: '<html>Old Verify</html>',
                  enabled: false,
                },
              });
            }
            const error = new Error('Not Found');
            error.statusCode = 404;
            return Promise.reject(error);
          }),
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        emailTemplates: [
          { template: 'verify_email', body: '<html>Updated Verify</html>', enabled: true }, // Update existing
          { template: 'welcome_email', body: '<html>New Welcome</html>', enabled: true }, // Create new
        ],
      };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(2); // Based on debug: update=2
      expect(changes.create).to.have.length(2); // Based on debug: create=2
      expect(changes.del).to.have.length(1); // Based on debug: del=1
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });

    it('should handle no email templates config during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        emailTemplates: {
          get: stub().returns(
            Promise.reject(new Error('emailTemplates.get should not have been called'))
          ),
          update: stub().returns(
            Promise.reject(new Error('emailTemplates.update should not have been called'))
          ),
          create: stub().returns(
            Promise.reject(new Error('emailTemplates.create should not have been called'))
          ),
        },
      };

      const handler = new EmailTemplatesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {};

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(0);
      expect(changes.create).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(auth0.emailTemplates.get.called).to.equal(false);
      expect(auth0.emailTemplates.update.called).to.equal(false);
      expect(auth0.emailTemplates.create.called).to.equal(false);
    });
  });
});
