const { expect } = require('chai');
const tenant = require('../../../../src/tools/auth0/handlers/tenant');

describe('#tenant handler', () => {
  describe('#tenant validate', () => {
    it('should not allow pages in tenant config', async () => {
      const handler = new tenant.default({ client: {} });
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

    const handler = new tenant.default({ client: auth0 });
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
            return Promise.resolve(data);
          },
        },
      };

      const handler = new tenant.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ tenant: { sandbox_version: '4' } }]);
    });

    it("should remove migration flags if don't exist on target tenant", async () => {
      const mockFlags = {
        trust_azure_adfs_email_verified_connection_property: true, // Migration flag
        'some-flag-1': true,
        'some-flag-2': false,
      };

      const auth0 = {
        tenant: {
          getSettings: async () => {
            const flags = { ...mockFlags };
            delete flags.trust_azure_adfs_email_verified_connection_property;
            return Promise.resolve({
              friendly_name: 'Test',
              default_directory: 'users',
              flags,
            });
          },
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.flags).to.deep.equal(
              (() => {
                const flags = { ...mockFlags };
                delete flags.trust_azure_adfs_email_verified_connection_property;
                return flags;
              })()
            );
            return Promise.resolve(data);
          },
        },
      };

      const handler = new tenant.default({ client: auth0 });
      const { processChanges } = Object.getPrototypeOf(handler);

      await processChanges.apply(handler, [{ tenant: { flags: mockFlags } }]);
    });
  });

  describe('#sanitizeMigrationFlags function', () => {
    it('should not alter flags if existing and proposed are identical', () => {
      const flags = {
        trust_azure_adfs_email_verified_connection_property: true,
        'some-flag-1': false,
        'some-flag-2': true,
      };

      const result = tenant.sanitizeMigrationFlags({
        existingFlags: flags,
        proposedFlags: flags,
      });

      expect(result).to.deep.equal(flags);
    });

    it("should not remove migration flag if proposed but doesn't exist currently", () => {
      const existingFlags = {
        'some-flag-1': false,
        'some-flag-2': true,
      };

      const proposedFlags = {
        trust_azure_adfs_email_verified_connection_property: true, // Migration flag
        'some-flag-1': true,
        'some-flag-2': true,
      };

      const result = tenant.sanitizeMigrationFlags({
        existingFlags,
        proposedFlags,
      });

      const expectedFlags = (() => {
        const expected = proposedFlags;
        delete expected.trust_azure_adfs_email_verified_connection_property;
        return expected;
      })();

      expect(result).to.deep.equal(expectedFlags);
    });

    it('allow alterations to migration flags if they currently exist', () => {
      const existingFlags = {
        'some-flag-1': false,
        'some-flag-2': true,
        trust_azure_adfs_email_verified_connection_property: false, // Migration flag
      };

      const proposedFlags = {
        trust_azure_adfs_email_verified_connection_property: true, // Migration flag
        'some-flag-1': true,
        'some-flag-2': false,
      };

      const result = tenant.sanitizeMigrationFlags({ existingFlags, proposedFlags });

      expect(result).to.deep.equal(proposedFlags);
    });

    it('should allow alterations of non-migration flags even if they do not currently exist', () => {
      const existingFlags = {
        trust_azure_adfs_email_verified_connection_property: true,
      };

      const proposedFlags = {
        trust_azure_adfs_email_verified_connection_property: true,
        'some-flag-1': false, // Doesn't currently exist
        'some-flag-2': true, // Doesn't currently exist
        'some-flag-3': true, // Doesn't currently exist
      };

      const result = tenant.sanitizeMigrationFlags({ existingFlags, proposedFlags });

      expect(result).to.deep.equal(proposedFlags);
    });

    it('should not throw if allow empty flag objects passed', () => {
      const mockFlags = {
        trust_azure_adfs_email_verified_connection_property: true,
        'some-flag-1': false, // Doesn't currently exist
        'some-flag-2': true, // Doesn't currently exist
      };

      expect(() =>
        tenant.sanitizeMigrationFlags({ existingFlags: {}, proposedFlags: {} })
      ).to.not.throw();
      expect(() =>
        tenant.sanitizeMigrationFlags({ existingFlags: mockFlags, proposedFlags: {} })
      ).to.not.throw();
      expect(() =>
        tenant.sanitizeMigrationFlags({ existingFlags: {}, proposedFlags: mockFlags })
      ).to.not.throw();
    });
  });
});
