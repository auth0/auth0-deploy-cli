import { expect } from 'chai';
import * as sinon from 'sinon';
import tenantHandler, {
  allowedTenantFlags,
  removeUnallowedTenantFlags,
} from '../../../../src/tools/auth0/handlers/tenant';
import log from '../../../../src/logger';

const mockAllowedFlags = Object.values(allowedTenantFlags).reduce<Record<string, boolean>>(
  (acc, cur) => {
    acc[cur] = true;
    return acc;
  },
  {}
);

describe('#tenant handler', () => {
  describe('#tenant validate', () => {
    it('should not allow pages in tenant config', async () => {
      // @ts-ignore
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
        settings: {
          get: () => ({
            friendly_name: 'Test',
            default_directory: 'users',
            client_id_metadata_document_supported: true,
            resource_parameter_profile: 'compatibility',
            flags: {
              ...mockAllowedFlags,
              'unallowed-flag-1': false,
              'unallowed-flag-2': true,
            },
          }),
        },
      },
    };

    // @ts-ignore
    const handler = new tenantHandler({ client: auth0 });
    const data = await handler.getType();
    expect(data).to.deep.equal({
      friendly_name: 'Test',
      default_directory: 'users',
      client_id_metadata_document_supported: true,
      resource_parameter_profile: 'compatibility',
      flags: mockAllowedFlags,
    });
  });

  describe('#tenant process', () => {
    it('should update tenant settings', async () => {
      const auth0 = {
        tenants: {
          settings: {
            get: () => ({
              friendly_name: 'Test',
              default_directory: 'users',
              skip_non_verifiable_callback_uri_confirmation_prompt: true,
            }),
            update: (data) => {
              expect(data).to.be.an('object');
              expect(data.sandbox_version).to.equal('4');
              expect(data.skip_non_verifiable_callback_uri_confirmation_prompt).to.equal(null);
              expect(data.client_id_metadata_document_supported).to.equal(true);
              expect(data.resource_parameter_profile).to.equal('compatibility');
              expect(data.flags).to.equal(undefined);
              return Promise.resolve(data);
            },
          },
        },
      };

      //@ts-ignore
      const handler = new tenantHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          tenant: {
            sandbox_version: '4',
            skip_non_verifiable_callback_uri_confirmation_prompt: null,
            client_id_metadata_document_supported: true,
            resource_parameter_profile: 'compatibility',
          },
        },
      ]);
    });

    it('should update tenant with dynamic_client_registration_security_mode', async () => {
      let updatedData = null;
      const auth0 = {
        tenants: {
          settings: {
            update: (data) => {
              updatedData = data;
              return Promise.resolve(data);
            },
          },
        },
      };

      // @ts-ignore
      const handler = new tenantHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { tenant: { dynamic_client_registration_security_mode: 'strict' } },
      ]);

      expect(updatedData).to.not.be.null;
      expect(updatedData.dynamic_client_registration_security_mode).to.equal('strict');
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
          settings: {
            get: () => ({}),
            update: function (data) {
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
        },
      };
      // @ts-ignore
      const handler = new tenantHandler({ client: auth0 });
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
            settings: {
              update: (data) => {
                expect(data).to.be.an('object');
                expect(data.flags).to.deep.equal({
                  require_pushed_authorization_requests: true,
                  mfa_show_factor_list_on_enrollment: false,
                });
                return Promise.resolve(data);
              },
            },
          },
        };

        // @ts-ignore
        const handler = new tenantHandler({ client: auth0 });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });

      it('should not set `flags` property on request payload if no allowed flags proposed', async () => {
        const proposedFlags = {
          'unallowed-flag-1': true,
        };

        const auth0 = {
          tenants: {
            settings: {
              update: (data) => {
                expect(data).to.be.an('object');
                expect(data.flags).to.be.undefined;
                return Promise.resolve(data);
              },
            },
          },
        };

        // @ts-ignore
        const handler = new tenantHandler({ client: auth0 });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [{ tenant: { flags: proposedFlags } }]);
      });

      it('should log a deprecation warning when enable_custom_domain_in_emails is set', async () => {
        const logWarnStub = sinon.stub(log, 'warn');

        const auth0 = {
          tenants: {
            settings: {
              update: async () => {},
            },
          },
        };

        // @ts-ignore
        const handler = new tenantHandler({ client: auth0 });
        const { processChanges } = Object.getPrototypeOf(handler);

        await processChanges.apply(handler, [
          { tenant: { flags: { enable_custom_domain_in_emails: true } } },
        ]);

        expect(logWarnStub.calledWithMatch('enable_custom_domain_in_emails')).to.equal(true);

        logWarnStub.restore();
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

  describe('#tenant processChanges dry-run', () => {
    it('should convert session durations from hours to minutes in update payload', async () => {
      let capturedPayload: any = null;
      const auth0 = {
        tenants: {
          settings: {
            get: () => ({
              friendly_name: 'Test',
              session_lifetime_in_minutes: 60,
              idle_session_lifetime_in_minutes: 120,
            }),
            update: (data: any) => {
              capturedPayload = data;
              return Promise.resolve(data);
            },
          },
        },
      };

      // @ts-ignore — standard test pattern
      const handler = new tenantHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          tenant: {
            friendly_name: 'Updated Test',
            session_lifetime: 2,
            idle_session_lifetime: 3,
          },
        },
      ]);

      expect(capturedPayload).to.not.be.null;
      expect(capturedPayload.session_lifetime_in_minutes).to.equal(120);
      expect(capturedPayload.idle_session_lifetime_in_minutes).to.equal(180);
      expect(capturedPayload).to.not.have.property('session_lifetime');
      expect(capturedPayload).to.not.have.property('idle_session_lifetime');
    });
  });
});
