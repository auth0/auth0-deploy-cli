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
            return Promise.resolve(data);
          },
          update: function (templateName, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(templateName).to.be.a('string');
            expect(data).to.be.an('object');
            expect(templateName).to.equal('verify_email');
            expect(data.template).to.equal('verify_email');
            expect(data.body).to.equal('body');
            return Promise.resolve(data);
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
          get: (templateName) =>
            Promise.resolve({
              template: templateName,
              enabled: true,
              body: '<html>some email</html>',
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
            return Promise.resolve(data);
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

    it('should update async_approval template operations', async () => {
      const auth0 = {
        emailTemplates: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.template).to.equal('async_approval');
            expect(data.body).to.equal('<html>async approval</html>');
            expect(data.subject).to.equal('Async Approval Required');
            return Promise.resolve(data);
          },
          update: function (templateName, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(templateName).to.be.a('string');
            expect(data).to.be.an('object');
            expect(templateName).to.equal('async_approval');
            expect(data.template).to.equal('async_approval');
            expect(data.body).to.equal('<html>async approval</html>');
            return Promise.resolve(data);
          },
        },
      };

      const handler = new emailTemplates.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          emailTemplates: [
            {
              template: 'async_approval',
              body: '<html>async approval</html>',
              subject: 'Async Approval Required',
              enabled: true,
            },
          ],
        },
      ]);
    });

    it('should get async_approval in response', async () => {
      const auth0 = {
        emailTemplates: {
          get: (templateName) =>
            Promise.resolve({
              template: templateName,
              enabled: true,
              body: '<html>some email</html>',
              subject:
                templateName === 'async_approval' ? 'Async Approval Required' : 'Test Subject',
            }),
        },
      };

      const handler = new emailTemplates.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data.length).to.be.above(1);
      const asyncApproval = data.find((t) => t.template === 'async_approval');
      expect(asyncApproval).to.deep.equal({
        template: 'async_approval',
        enabled: true,
        body: '<html>some email</html>',
        subject: 'Async Approval Required',
      });
    });
  });
});
