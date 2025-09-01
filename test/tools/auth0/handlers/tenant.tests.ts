import tenantHandler, {
  allowedTenantFlags,
  removeUnallowedTenantFlags,
} from '../../../../src/tools/auth0/handlers/tenant';

const { expect } = require('chai');

const mockAllowedFlags = Object.values(allowedTenantFlags).reduce<Record<string, boolean>>(
  (acc, cur) => {
    acc[cur] = true;
    return acc;
  },
  {}
);

describe('#tenant handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_DRY_RUN: false,
  };

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
      tenants: {
        getSettings: () => ({
          data: {
            friendly_name: 'Test',
            default_directory: 'users',
            flags: {
              ...mockAllowedFlags,
              'unallowed-flag-1': false,
              'unallowed-flag-2': true,
            },
          },
        }),
      },
    };

    //@ts-ignore
    const handler = new tenantHandler({ client: auth0 });
    const data = await handler.getType();
    expect(data).to.deep.equal({
      friendly_name: 'Test',
      default_directory: 'users',
      flags: mockAllowedFlags,
    });
  });

  describe('#tenant process', () => {
    it('should update tenant settings', async () => {
      const auth0 = {
        tenants: {
          getSettings: () => ({
            data: {
              friendly_name: 'Test',
              default_directory: 'users',
            },
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
      const handler = new tenantHandler({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ tenant: { sandbox_version: '4' } }]);
    });

    it('should allow valid default_token_quota property in tenant', async () => {
      const tenantWithDefaultTokenQuota = {
        default_token_quota: {
          clients: {
            client_credentials: {
              enforce: true,
              per_day: 2000,
              per_hour: 200,
            },
          },
          organizations: {
            client_credentials: {
              enforce: false,
              per_day: 1000,
              per_hour: 100,
            },
          },
        },
      };
      let wasUpdateCalled = false;
      const auth0 = {
        tenants: {
          getSettings: () => ({ data: {} }),
          updateSettings: function (data) {
            wasUpdateCalled = true;
            expect(data).to.be.an('object');
            expect(data.default_token_quota).to.deep.equal({
              clients: {
                client_credentials: {
                  enforce: true,
                  per_day: 2000,
                  per_hour: 200,
                },
              },
              organizations: {
                client_credentials: {
                  enforce: false,
                  per_day: 1000,
                  per_hour: 100,
                },
              },
            });
            return Promise.resolve(data);
          },
        },
      };
      // @ts-ignore
      const handler = new tenantHandler({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ tenant: tenantWithDefaultTokenQuota }]);
      // eslint-disable-next-line no-unused-expressions
      expect(wasUpdateCalled).to.be.true;
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
          tenants: {
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

        // @ts-ignore
        const handler = new tenantHandler({ client: auth0, config });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });

      it('should not set `flags` property on request payload if no allowed flags proposed', async () => {
        const proposedFlags = {
          'unallowed-flag-1': true,
        };

        const auth0 = {
          tenants: {
            updateSettings: (data) => {
              expect(data).to.be.an('object');
              expect(data.flags).to.be.undefined;
              return Promise.resolve({ data });
            },
          },
        };

        //@ts-ignore
        const handler = new tenantHandler({ client: auth0, config });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });
    });
  });

  describe('#removeUnallowedTenantFlags function', () => {
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

  describe('#tenant dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return update changes for tenant with differences', async () => {
      const existingTenant = {
        friendly_name: 'Old Name',
        default_directory: 'users',
        flags: {
          change_pwd_flow_v1: false,
          enable_client_connections: true,
        },
      };

      const auth0 = {
        tenants: {
          getSettings: () => Promise.resolve({ data: existingTenant }),
        },
      };

      // @ts-ignore
      const handler = new tenantHandler({ client: auth0, config: dryRunConfig });
      const assets = {
        tenant: {
          friendly_name: 'New Name',
          default_directory: 'users',
          flags: {
            change_pwd_flow_v1: true,
            enable_client_connections: true,
          },
        },
      };

      // @ts-ignore
      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when tenant is identical', async () => {
      const existingTenant = {
        friendly_name: 'Same Name',
        default_directory: 'users',
        flags: {
          change_pwd_flow_v1: false,
          enable_client_connections: true,
        },
      };

      const auth0 = {
        tenants: {
          getSettings: () => Promise.resolve({ data: existingTenant }),
        },
      };

      // @ts-ignore
      const handler = new tenantHandler({ client: auth0, config: dryRunConfig });
      const assets = {
        tenant: {
          friendly_name: 'Same Name',
          default_directory: 'users',
          flags: {
            change_pwd_flow_v1: false,
            enable_client_connections: true,
          },
        },
      };

      // @ts-ignore
      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const existingTenant = {
        friendly_name: 'Current Name',
        default_directory: 'users',
      };

      const auth0 = {
        tenants: {
          getSettings: () => Promise.resolve({ data: existingTenant }),
        },
      };

      // @ts-ignore
      const handler = new tenantHandler({ client: auth0, config: dryRunConfig });
      const assets = {}; // No tenant property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
