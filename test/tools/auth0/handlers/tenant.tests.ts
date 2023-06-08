const { expect } = require('chai');

import TenantHandler from '../../../../src/tools/auth0/handlers/tenant';
import tenantHandler, {
  allowedTenantFlags,
  removeUnallowedTenantFlags,
} from '../../../../src/tools/auth0/handlers/tenant';

describe('#tenant handler', () => {
  describe('#tenant validate', () => {
    it('should not allow pages in tenant config', async () => {
      //@ts-ignore
      const handler = new tenantHandler({ client: {} });
      const stageFn = Object.getPrototypeOf(handler).validate;

      try {
        await stageFn.apply(handler, [{ tenant: { password_reset: 'page_body' } }]);
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
          default_directory: 'users',
        }),
      },
    };

    //@ts-ignore
    const handler = new tenantHandler({ client: auth0 });
    const data = await handler.getType();
    expect(data).to.deep.equal({
      friendly_name: 'Test',
      default_directory: 'users',
    });
  });

  describe('#tenant process', () => {
    it('should update tenant settings', async () => {
      const auth0 = {
        tenant: {
          getSettings: () => ({
            friendly_name: 'Test',
            default_directory: 'users',
          }),
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.sandbox_version).to.equal('4');
            expect(data.flags).to.equal(undefined);
            return Promise.resolve(data);
          },
        },
      };

      //@ts-ignore
      const handler = new tenantHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ tenant: { sandbox_version: '4' } }]);
    });

    describe('filtering-out unallowed tenant flags', async () => {
      it('should filter-out unallowed tenant flags', async () => {
        const proposedFlags = {
          require_pushed_authorization_requests: true,
          mfa_show_factor_list_on_enrollment: false,
          'unallowed-flag-1': true,
          'unallowed-flag-2': false,
        };

        const auth0 = {
          tenant: {
            updateSettings: (data) => {
              expect(data).to.be.an('object');
              expect(data.flags).to.deep.equal({
                require_pushed_authorization_requests: true,
                mfa_show_factor_list_on_enrollment: false,
              });
              return Promise.resolve(data);
            },
          },
        };

        //@ts-ignore
        const handler = new tenantHandler({ client: auth0 });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });

      it('should not set `flags` property on request payload if no allowed flags proposed', async () => {
        const proposedFlags = {
          'unallowed-flag-1': true,
        };

        const auth0 = {
          tenant: {
            updateSettings: (data) => {
              expect(data).to.be.an('object');
              expect(data.flags).to.be.undefined;
              return Promise.resolve(data);
            },
          },
        };

        //@ts-ignore
        const handler = new tenantHandler({ client: auth0 });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });
    });
  });

  describe('#removeUnallowedTenantFlags function', () => {
    const mockAllowedFlags = Object.values(allowedTenantFlags).reduce<Record<string, boolean>>(
      (acc, cur) => {
        acc[cur] = true;
        return acc;
      },
      {}
    );

    it('should not alter flags if all are included and allowed', () => {
      const result = removeUnallowedTenantFlags(mockAllowedFlags);
      expect(result).to.deep.equal(mockAllowedFlags);
    });

    it('should remove flags outside the allowed list', () => {
      const proposedFlags = {
        ...mockAllowedFlags,
        trust_azure_adfs_email_verified_connection_property: true,
        'some-unallowed-flag-1': true,
        'some-unallowed-flag-2': true,
      };

      const result = removeUnallowedTenantFlags(proposedFlags);

      expect(result).to.deep.equal(mockAllowedFlags);
    });

    it('should not throw if allow empty flag objects passed', () => {
      expect(() => removeUnallowedTenantFlags({})).to.not.throw();
    });
  });
});
