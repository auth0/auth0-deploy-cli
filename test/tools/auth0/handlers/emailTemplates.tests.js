const { expect } = require('chai');
const emailTemplates = require('../../../../src/tools/auth0/handlers/emailTemplates');

describe('#emailTemplates handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
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

      const handler = new emailTemplates.default({ client: auth0 });
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
            }
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

      const handler = new emailTemplates.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { emailTemplates: [{ template: 'verify_email', body: 'body' }] },
      ]);
    });
  });
});
