const Ajv = require('ajv');
const { expect } = require('chai');
const clientProfiles = require('../../../../src/tools/auth0/handlers/clientProfiles');
const { mockPagedData } = require('../../../utils');
const pageClient = require('../../../../src/tools/auth0/client').default;
const log = require('../../../../src/logger').default;

const sampleProfile = {
  name: 'CIMD Profile',
  description: 'Policy for CIMD clients',
  client_configuration: {
    refresh_token: {
      token_lifetime: { default_value: 2592000 },
      idle_token_lifetime: { default_value: 1296000 },
      leeway: { default_value: 0 },
    },
    organization_usage: { default_value: 'allow' },
    organization_require_behavior: { default_value: 'pre_login_prompt' },
    organization_discovery_methods: { default_value: ['email', 'organization_name'] },
    require_proof_of_possession: { default_value: true },
  },
  apply_policy: {
    external_metadata_type: 'cimd',
    external_metadata_created_by: 'client',
  },
};

const existingProfile = {
  ...sampleProfile,
  id: 'cp_123',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

const mockClient = (overrides = {}, existing = []) => ({
  clientProfiles: {
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve(),
    list: (params) => mockPagedData(params, 'clientProfiles', existing),
    ...overrides,
  },
});

describe('#clientProfiles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  beforeEach(() => {
    config.data = {
      AUTH0_ALLOW_DELETE: true,
    };
  });

  describe('#clientProfiles schema', () => {
    const ajv = new Ajv({ useDefaults: true, nullable: true });

    it('should pass validation with a full profile', () => {
      const valid = ajv.validate(clientProfiles.schema, [sampleProfile]);
      expect(ajv.errors).to.be.null;
      expect(valid).to.equal(true);
    });

    it('should pass validation with null description and empty client_configuration', () => {
      const valid = ajv.validate(clientProfiles.schema, [
        {
          name: 'Minimal',
          description: null,
          client_configuration: {},
          apply_policy: sampleProfile.apply_policy,
        },
      ]);
      expect(ajv.errors).to.be.null;
      expect(valid).to.equal(true);
    });

    it('should fail validation when apply_policy is missing', () => {
      const { apply_policy, ...rest } = sampleProfile;
      expect(ajv.validate(clientProfiles.schema, [rest])).to.equal(false);
    });

    it('should fail validation when client_configuration is missing', () => {
      const { client_configuration, ...rest } = sampleProfile;
      expect(ajv.validate(clientProfiles.schema, [rest])).to.equal(false);
    });

    it('should fail validation with an unsupported apply_policy value', () => {
      const valid = ajv.validate(clientProfiles.schema, [
        {
          ...sampleProfile,
          apply_policy: { external_metadata_type: 'oidc', external_metadata_created_by: 'client' },
        },
      ]);
      expect(valid).to.equal(false);
    });

    it('should fail validation with an unsupported organization_usage value', () => {
      const valid = ajv.validate(clientProfiles.schema, [
        {
          ...sampleProfile,
          client_configuration: { organization_usage: { default_value: 'sometimes' } },
        },
      ]);
      expect(valid).to.equal(false);
    });

    it('should fail validation with a non-integer refresh token lifetime', () => {
      const valid = ajv.validate(clientProfiles.schema, [
        {
          ...sampleProfile,
          client_configuration: { refresh_token: { token_lifetime: { default_value: '1d' } } },
        },
      ]);
      expect(valid).to.equal(false);
    });
  });

  describe('#clientProfiles validate', () => {
    it('should not allow same names', async () => {
      const handler = new clientProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      let error;
      try {
        await stageFn.apply(handler, [{ clientProfiles: [sampleProfile, sampleProfile] }]);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('object');
      expect(error.message).to.include('Names must be unique');
    });

    it('should pass validation', async () => {
      const handler = new clientProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      await stageFn.apply(handler, [{ clientProfiles: [sampleProfile] }]);
    });
  });

  describe('#clientProfiles getType', () => {
    it('should return existing client profiles', async () => {
      const handler = new clientProfiles.default({
        client: pageClient(mockClient({}, [existingProfile])),
        config,
      });
      const data = await handler.getType();
      expect(data).to.deep.equal([existingProfile]);
    });

    [403, 404, 501].forEach((statusCode) => {
      it(`should return empty array when list fails with ${statusCode}`, async () => {
        const handler = new clientProfiles.default({
          client: pageClient(
            mockClient({
              list: () => {
                const error = new Error('Feature not enabled');
                error.statusCode = statusCode;
                return Promise.reject(error);
              },
            })
          ),
          config,
        });
        const data = await handler.getType();
        expect(data).to.deep.equal([]);
      });
    });

    it('should leave clientProfiles out of the export when the read scope is missing', async () => {
      const warnings = [];
      const originalWarn = log.warn;
      log.warn = (message) => warnings.push(message);
      let result;
      try {
        const handler = new clientProfiles.default({
          client: pageClient(
            mockClient({
              list: () => {
                const error = new Error(
                  'Insufficient scope, expected any of: read:client_profiles'
                );
                error.statusCode = 403;
                error.body = { statusCode: 403, errorCode: 'insufficient_scope' };
                return Promise.reject(error);
              },
            })
          ),
          config,
        });
        result = await handler.load();
      } finally {
        log.warn = originalWarn;
      }
      expect(result).to.deep.equal({ clientProfiles: null });
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.include('read:client_profiles');
    });

    it('should rethrow other errors', async () => {
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient({
            list: () => {
              const error = new Error('Internal error');
              error.statusCode = 500;
              return Promise.reject(error);
            },
          })
        ),
        config,
      });

      let error;
      try {
        await handler.getType();
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.equal('Internal error');
    });
  });

  describe('#clientProfiles process', () => {
    it('should create client profile', async () => {
      let created;
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient({
            create: function (data) {
              created = data;
              return Promise.resolve({ ...data, id: 'cp_new' });
            },
          })
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientProfiles: [sampleProfile] }]);
      expect(created).to.deep.equal(sampleProfile);
    });

    it('should update client profile and strip read-only fields', async () => {
      let updatedId;
      let updated;
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              create: () => Promise.reject(new Error('create should not be called')),
              update: function (id, data) {
                updatedId = id;
                updated = data;
                return Promise.resolve({ ...data, id });
              },
            },
            [existingProfile]
          )
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const changed = {
        ...sampleProfile,
        client_configuration: {
          ...sampleProfile.client_configuration,
          require_proof_of_possession: { default_value: false },
        },
      };
      await stageFn.apply(handler, [{ clientProfiles: [changed] }]);

      expect(updatedId).to.equal('cp_123');
      expect(updated).to.deep.equal(changed);
      expect(updated).to.not.have.any.keys('id', 'created_at', 'updated_at');
    });

    it('should delete client profile when AUTH0_ALLOW_DELETE is true', async () => {
      let deletedId;
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              delete: function (id) {
                deletedId = id;
                return Promise.resolve();
              },
            },
            [existingProfile]
          )
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientProfiles: [] }]);
      expect(deletedId).to.equal('cp_123');
    });

    it('should not delete client profile when AUTH0_ALLOW_DELETE is false', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              delete: () => Promise.reject(new Error('delete should not be called')),
            },
            [existingProfile]
          )
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientProfiles: [] }]);
    });

    it('should replace a renamed profile when AUTH0_ALLOW_DELETE is true', async () => {
      const calls = [];
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              delete: function (id) {
                calls.push(`delete:${id}`);
                return Promise.resolve();
              },
              create: function (data) {
                calls.push(`create:${data.name}`);
                return Promise.resolve({ ...data, id: 'cp_new' });
              },
            },
            [existingProfile]
          )
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientProfiles: [{ ...sampleProfile, name: 'Renamed' }] }]);
      expect(calls).to.deep.equal(['delete:cp_123', 'create:Renamed']);
    });

    it('should fail before calling the API when a rename exceeds the tenant limit and deletes are disabled', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              create: () => Promise.reject(new Error('create should not be called')),
              delete: () => Promise.reject(new Error('delete should not be called')),
            },
            [existingProfile]
          )
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      let error;
      try {
        await stageFn.apply(handler, [{ clientProfiles: [{ ...sampleProfile, name: 'Renamed' }] }]);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('at most 1 client profile');
      expect(error.message).to.include('AUTH0_ALLOW_DELETE=true');
    });

    it('should fail before calling the API when more than one profile is configured', async () => {
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient({
            create: () => Promise.reject(new Error('create should not be called')),
          })
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      let error;
      try {
        await stageFn.apply(handler, [
          { clientProfiles: [sampleProfile, { ...sampleProfile, name: 'Second' }] },
        ]);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('at most 1 client profile');
    });

    it('should do nothing when clientProfiles is not set', async () => {
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient({
            create: () => Promise.reject(new Error('create should not be called')),
            update: () => Promise.reject(new Error('update should not be called')),
            delete: () => Promise.reject(new Error('delete should not be called')),
          })
        ),
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
    });
  });
  describe('#clientProfiles dryRunChanges', () => {
    const dryRun = async (localProfiles, existing, overrides = {}) => {
      const handler = new clientProfiles.default({
        client: pageClient(
          mockClient(
            {
              create: () => Promise.reject(new Error('create should not be called in dry run')),
              update: () => Promise.reject(new Error('update should not be called in dry run')),
              delete: () => Promise.reject(new Error('delete should not be called in dry run')),
              ...overrides,
            },
            existing
          )
        ),
        config,
      });
      // dry run backfills remote ids onto local assets, so pass copies to keep fixtures untouched
      return handler.dryRunChanges({
        clientProfiles: localProfiles && JSON.parse(JSON.stringify(localProfiles)),
      });
    };

    const names = (items) => items.map((i) => i.name);

    it('should return no changes when clientProfiles is not set', async () => {
      const changes = await dryRun(undefined, [existingProfile]);
      expect(changes).to.deep.equal({ del: [], create: [], conflicts: [], update: [] });
    });

    it('should report CREATE for a new profile', async () => {
      const changes = await dryRun([sampleProfile], []);
      expect(names(changes.create)).to.deep.equal(['CIMD Profile']);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
    });

    it('should report no changes when local matches remote apart from read-only fields', async () => {
      const changes = await dryRun([sampleProfile], [existingProfile]);
      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
    });

    it('should report UPDATE when client_configuration changes', async () => {
      const changed = {
        ...sampleProfile,
        client_configuration: {
          ...sampleProfile.client_configuration,
          require_proof_of_possession: { default_value: false },
        },
      };
      const changes = await dryRun([changed], [existingProfile]);
      expect(names(changes.update)).to.deep.equal(['CIMD Profile']);
      expect(changes.create).to.have.length(0);
      expect(changes.del).to.have.length(0);
    });

    it('should report UPDATE when a client_configuration setting is removed locally', async () => {
      const { organization_discovery_methods, ...rest } = sampleProfile.client_configuration;
      const changes = await dryRun(
        [{ ...sampleProfile, client_configuration: rest }],
        [existingProfile]
      );
      expect(names(changes.update)).to.deep.equal(['CIMD Profile']);
      expect(changes.update[0].id).to.equal('cp_123');
      expect(changes.create).to.have.length(0);
    });

    it('should report UPDATE when description is cleared', async () => {
      const changes = await dryRun([{ ...sampleProfile, description: null }], [existingProfile]);
      expect(names(changes.update)).to.deep.equal(['CIMD Profile']);
    });

    it('should report DELETE when the profile is removed locally', async () => {
      const changes = await dryRun([], [existingProfile]);
      expect(names(changes.del)).to.deep.equal(['CIMD Profile']);
      expect(changes.create).to.have.length(0);
    });

    it('should report DELETE and CREATE for a rename when AUTH0_ALLOW_DELETE is true', async () => {
      const changes = await dryRun([{ ...sampleProfile, name: 'Renamed' }], [existingProfile]);
      expect(names(changes.del)).to.deep.equal(['CIMD Profile']);
      expect(names(changes.create)).to.deep.equal(['Renamed']);
    });

    it('should fail for a rename when AUTH0_ALLOW_DELETE is false, matching the real import', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      let error;
      try {
        await dryRun([{ ...sampleProfile, name: 'Renamed' }], [existingProfile]);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('at most 1 client profile');
    });

    it('should fail when more than one profile is configured', async () => {
      let error;
      try {
        await dryRun([sampleProfile, { ...sampleProfile, name: 'Second' }], []);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('at most 1 client profile');
    });

    it('should report CREATE when the feature is unavailable on the tenant', async () => {
      const changes = await dryRun([sampleProfile], [], {
        list: () => {
          const error = new Error('Forbidden');
          error.statusCode = 403;
          return Promise.reject(error);
        },
      });
      expect(names(changes.create)).to.deep.equal(['CIMD Profile']);
    });
  });
});
