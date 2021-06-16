const { expect } = require('chai');
const tenant = require('../../../../src/tools/auth0/handlers/tenant');

describe('#tenant handler', () => {
  describe('#tenant validate', () => {
    it('should not allow pages in tenant config', async () => {
      const handler = new tenant.default({ client: {} });
      const stageFn = Object.getPrototypeOf(handler).validate;

      try {
        await stageFn.apply(handler, [ { tenant: { password_reset: 'page_body' } } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Pages should be set separately');
      }
    });
  });

  it('should get tenant', async () => {
    const auth0 = {
      tenant: {
        getSettings: () => ({
          friendly_name: 'Test',
          default_directory: 'users'
        })
      }
    };

    const handler = new tenant.default({ client: auth0 });
    const data = await handler.getType();
    expect(data).to.deep.equal({
      friendly_name: 'Test',
      default_directory: 'users'
    });
  });

  describe('#tenant process', () => {
    it('should update tenant settings', async () => {
      const auth0 = {
        tenant: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.sandbox_version).to.equal('4');
            return Promise.resolve(data);
          }
        }
      };

      const handler = new tenant.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { tenant: { sandbox_version: '4' } } ]);
    });
  });
});
