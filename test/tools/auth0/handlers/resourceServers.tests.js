import pageClient from '../../../../src/tools/auth0/client';

const Ajv = require('ajv');
const { Management } = require('auth0');
const sinon = require('sinon');
const { expect } = require('chai');
const log = require('../../../../src/logger').default;
const resourceServers = require('../../../../src/tools/auth0/handlers/resourceServers');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#resourceServers handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#resourceServers validate', () => {
    it('should not allow same names', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI',
        },
        {
          name: 'someAPI',
        },
      ];

      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should not allow "Auth0 Management API" name', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Auth0 Management API',
        },
      ];

      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include("You can not configure the 'Auth0 Management API'.");
      }
    });

    it('should pass validation', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI',
        },
      ];

      await stageFn.apply(handler, [{ resourceServers: data }]);
    });

    it('should not allow more than one UCP-typed resource server', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        { name: 'commerceAPI', type: 'universal_commerce_protocol_server' },
        { name: 'otherCommerceAPI', type: 'universal_commerce_protocol_server' },
        { name: 'plainAPI' },
      ];

      let error;
      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
      } catch (err) {
        error = err;
      }

      expect(error).to.be.an('object');
      expect(error.message).to.include(
        "Only one resource server can have type 'universal_commerce_protocol_server'"
      );
      expect(error.message).to.include('commerceAPI, otherCommerceAPI');
    });

    it('should not count an excluded UCP-typed resource server', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        { name: 'commerceAPI', type: 'universal_commerce_protocol_server' },
        { name: 'excludedAPI', type: 'universal_commerce_protocol_server' },
      ];

      await stageFn.apply(handler, [
        { resourceServers: data, exclude: { resourceServers: ['excludedAPI'] } },
      ]);
    });

    it('should not count a system resource server, whose type is never sent', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        { name: 'systemAPI', is_system: true, type: 'universal_commerce_protocol_server' },
        { name: 'commerceAPI', type: 'universal_commerce_protocol_server' },
      ];

      await stageFn.apply(handler, [{ resourceServers: data }]);
    });

    it('should warn about type null combined with dev.ucp scopes', async () => {
      const warn = sinon.stub(log, 'warn');
      try {
        const handler = new resourceServers.default({ client: {}, config });
        const stageFn = Object.getPrototypeOf(handler).validate;
        const data = [
          { name: 'oldAPI', type: null, scopes: [{ value: 'dev.ucp.shopping.checkout' }] },
        ];

        await stageFn.apply(handler, [{ resourceServers: data }]);

        expect(warn.calledOnce).to.equal(true);
        expect(warn.firstCall.args[0]).to.include("'oldAPI' sets 'type: null' but still has");
      } finally {
        warn.restore();
      }
    });

    it('should not warn about dev.ucp scopes on the UCP-typed server or type null with other scopes', async () => {
      const warn = sinon.stub(log, 'warn');
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'commerceAPI',
          type: 'universal_commerce_protocol_server',
          scopes: [{ value: 'dev.ucp.shopping.checkout' }],
        },
        { name: 'oldAPI', type: null, scopes: [{ value: 'read:orders' }] },
        { name: 'clearedAPI', type: null, scopes: [] },
        { name: 'untypedAPI', scopes: [{ value: 'dev.ucp.shopping.cart' }] },
      ];

      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
        expect(warn.called).to.equal(false);
      } finally {
        warn.restore();
      }
    });

    it('should allow one UCP-typed resource server alongside others, including type null', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        { name: 'commerceAPI', type: 'universal_commerce_protocol_server' },
        { name: 'clearedAPI', type: null },
        { name: 'plainAPI' },
      ];

      await stageFn.apply(handler, [{ resourceServers: data }]);
    });

    describe('type schema', () => {
      const ajv = new Ajv({ useDefaults: true, nullable: true });
      const check = (type) =>
        ajv.validate(resourceServers.schema, [{ name: 'someAPI', identifier: 'some-api', type }]);

      it('should accept the UCP type and null', () => {
        expect(check('universal_commerce_protocol_server')).to.equal(true);
        expect(check(null)).to.equal(true);
      });

      it('should accept every value of the SDK type enum', () => {
        Object.values(Management.ResourceServerTypeEnum).forEach((value) => {
          expect(check(value)).to.equal(true);
        });
      });

      it('should accept an omitted type', () => {
        expect(
          ajv.validate(resourceServers.schema, [{ name: 'someAPI', identifier: 'some-api' }])
        ).to.equal(true);
      });

      it('should reject any other type value', () => {
        expect(check('universal_commerce_protocol')).to.equal(false);
        expect(check('')).to.equal(false);
        expect(check(5)).to.equal(false);
      });
    });
  });

  describe('#resourceServers process', () => {
    describe('type (Universal Commerce Protocol)', () => {
      const UCP = 'universal_commerce_protocol_server';
      const holder = {
        id: 'rs1',
        name: 'oldAPI',
        identifier: 'https://old.example.com',
        type: UCP,
      };
      const plain = { id: 'rs2', name: 'newAPI', identifier: 'https://new.example.com' };
      const brandNew = { name: 'brandNew', identifier: 'https://brand.example.com', type: UCP };

      let warn;
      beforeEach(() => {
        warn = sinon.stub(log, 'warn');
      });
      afterEach(() => {
        warn.restore();
      });

      // Awaits tasks in order so the API call order is observable
      const sequentialPool = {
        addEachTask: ({ data, generator }) => {
          const done = (async () => {
            for (const item of data || []) {
              // eslint-disable-next-line no-await-in-loop
              await generator(item);
            }
          })();
          return { promise: () => done };
        },
      };

      const run = async (
        existing,
        desired,
        { allowDelete = true, exclude, extensionSecret, failUpdate } = {}
      ) => {
        const calls = [];
        const auth0 = {
          resourceServers: {
            create: (data) => {
              calls.push(`create:${data.name}:${data.type}`);
              return Promise.resolve({ ...data, id: 'new' });
            },
            update: (id, data) => {
              calls.push(`update:${id}:${data.type}`);
              if (id === failUpdate) return Promise.reject(new Error('boom'));
              return Promise.resolve({ id, ...data });
            },
            delete: (id) => {
              calls.push(`delete:${id}`);
              return Promise.resolve([]);
            },
            list: (params) => mockPagedData(params, 'resource_servers', existing),
          },
          pool: sequentialPool,
        };
        const handler = new resourceServers.default({
          client: pageClient(auth0),
          config: (key) =>
            ({ AUTH0_ALLOW_DELETE: allowDelete, EXTENSION_SECRET: extensionSecret }[key]),
        });
        await Object.getPrototypeOf(handler).processChanges.apply(handler, [
          { resourceServers: desired, exclude: { resourceServers: exclude || [] } },
        ]);
        return calls;
      };

      it('should create a resource server with the type', async () => {
        expect(await run([], [brandNew])).to.deep.equal([`create:brandNew:${UCP}`]);
      });

      it('should clear the type with null', async () => {
        expect(await run([holder], [{ ...holder, type: null }])).to.deep.equal(['update:rs1:null']);
      });

      it('should set the type on an existing resource server', async () => {
        expect(await run([plain], [{ ...plain, type: UCP }])).to.deep.equal([`update:rs2:${UCP}`]);
      });

      it('should leave the type unset when the config omits it', async () => {
        expect(await run([plain], [plain])).to.deep.equal(['update:rs2:undefined']);
      });

      it('should keep a holder that keeps the type', async () => {
        const calls = await run([holder, plain], [holder, plain]);

        expect(calls).to.deep.equal([`update:rs1:${UCP}`, 'update:rs2:undefined']);
      });

      it('should clear the holder before another existing server takes the type', async () => {
        // New holder is listed first to show the order does not depend on the config order
        const calls = await run(
          [holder, plain],
          [
            { ...plain, type: UCP },
            { ...holder, type: null },
          ]
        );

        expect(calls).to.deep.equal(['update:rs1:null', `update:rs2:${UCP}`]);
      });

      it('should clear the holder before a newly created server takes the type', async () => {
        const calls = await run([holder], [{ ...holder, type: null }, brandNew]);

        expect(calls).to.deep.equal(['update:rs1:null', `create:brandNew:${UCP}`]);
      });

      it('should delete the holder before creating a replacement', async () => {
        expect(await run([holder], [brandNew])).to.deep.equal([
          'delete:rs1',
          `create:brandNew:${UCP}`,
        ]);
      });

      it('should clear a holder with no taker, then apply the other updates', async () => {
        const calls = await run([holder, plain], [plain, { ...holder, type: null }]);

        expect(calls).to.deep.equal(['update:rs1:null', 'update:rs2:undefined']);
      });

      it('should only release the server that holds the type', async () => {
        const calls = await run(
          [holder, plain],
          [{ ...holder, type: null }, { ...plain, type: null }, brandNew]
        );

        expect(calls).to.deep.equal([
          'update:rs1:null',
          `create:brandNew:${UCP}`,
          'update:rs2:null',
        ]);
      });

      it('should still move the type when deletes are not allowed', async () => {
        const calls = await run(
          [holder, plain],
          [
            { ...holder, type: null },
            { ...plain, type: UCP },
          ],
          { allowDelete: false }
        );

        expect(calls).to.deep.equal(['update:rs1:null', `update:rs2:${UCP}`]);
      });

      it('should move the type when the config has no ids', async () => {
        const calls = await run(
          [holder, plain],
          [
            { name: 'newAPI', identifier: plain.identifier, type: UCP },
            { name: 'oldAPI', identifier: holder.identifier, type: null },
          ]
        );

        expect(calls).to.deep.equal(['update:rs1:null', `update:rs2:${UCP}`]);
      });

      it('should say the type was already released when the next update fails', async () => {
        let error;
        try {
          await run(
            [holder, plain],
            [
              { ...holder, type: null },
              { ...plain, type: UCP },
            ],
            {
              failUpdate: 'rs2',
            }
          );
        } catch (err) {
          error = err;
        }

        expect(error.message).to.include('boom');
        expect(error.message).to.include("already released from 'oldAPI'");
      });

      it('should warn when another server takes the type and the holder omits it', async () => {
        const calls = await run([holder, plain], [holder, { ...plain, type: UCP }]);

        expect(calls).to.have.length(2);
        expect(warn.calledOnce).to.equal(true);
        expect(warn.firstCall.args[0]).to.include("'oldAPI' already has type");
        expect(warn.firstCall.args[0]).to.include("'newAPI'");
      });

      it('should warn when the holder is excluded and is left untouched', async () => {
        const calls = await run([holder, plain], [{ ...plain, type: UCP }], {
          exclude: ['oldAPI'],
        });

        expect(calls).to.deep.equal([`update:rs2:${UCP}`]);
        expect(warn.calledOnce).to.equal(true);
        expect(warn.firstCall.args[0]).to.include("'oldAPI' already has type");
      });

      it('should warn when the holder is removed from the config but deletes are off', async () => {
        const calls = await run([holder, plain], [{ ...plain, type: UCP }], {
          allowDelete: false,
        });

        expect(calls).to.deep.equal([`update:rs2:${UCP}`]);
        const message = warn.args
          .map(([msg]) => msg)
          .find((msg) => msg.includes('already has type'));
        expect(message).to.include("'oldAPI' already has type");
        expect(message).to.include('AUTH0_ALLOW_DELETE');
      });

      it('should not warn when an extension deletes the holder', async () => {
        const calls = await run([holder], [brandNew], {
          allowDelete: false,
          extensionSecret: 'secret',
        });

        expect(calls).to.deep.equal(['delete:rs1', `create:brandNew:${UCP}`]);
        expect(warn.called).to.equal(false);
      });

      it('should not warn when the holder is deleted, released, or keeps the type', async () => {
        await run([holder], [brandNew]);
        await run(
          [holder, plain],
          [
            { ...holder, type: null },
            { ...plain, type: UCP },
          ]
        );
        await run([holder, plain], [holder, plain]);

        expect(warn.called).to.equal(false);
      });

      describe('dry run', () => {
        const dryRun = async (existing, desired, exclude = []) => {
          const auth0 = {
            resourceServers: {
              list: (params) => mockPagedData(params, 'resource_servers', existing),
            },
            pool: sequentialPool,
          };
          const handler = new resourceServers.default({
            client: pageClient(auth0),
            config: (key) => ({ AUTH0_ALLOW_DELETE: true }[key]),
          });
          return Object.getPrototypeOf(handler).dryRunChanges.apply(handler, [
            { resourceServers: desired, exclude: { resourceServers: exclude } },
          ]);
        };

        it('should warn when another server takes the type and the holder omits it', async () => {
          const changes = await dryRun(
            [holder, plain],
            [
              { name: 'oldAPI', identifier: holder.identifier },
              { name: 'newAPI', identifier: plain.identifier, type: UCP },
            ]
          );

          expect(changes.update.map((r) => r.name)).to.deep.equal(['newAPI']);
          expect(warn.calledOnce).to.equal(true);
          expect(warn.firstCall.args[0]).to.include("'oldAPI' already has type");
        });

        it('should not warn when the holder is released', async () => {
          await dryRun(
            [holder, plain],
            [
              { name: 'oldAPI', identifier: holder.identifier, type: null },
              { name: 'newAPI', identifier: plain.identifier, type: UCP },
            ]
          );

          expect(warn.called).to.equal(false);
        });

        it('should not warn when the server taking the type is excluded', async () => {
          await dryRun(
            [holder, plain],
            [{ name: 'newAPI', identifier: plain.identifier, type: UCP }],
            ['newAPI']
          );

          expect(warn.called).to.equal(false);
        });

        it('should not fetch resource servers when the config has none', async () => {
          let listed = false;
          const auth0 = {
            resourceServers: {
              list: () => {
                listed = true;
                return Promise.resolve([]);
              },
            },
            pool: sequentialPool,
          };
          const handler = new resourceServers.default({ client: pageClient(auth0), config });

          const changes = await Object.getPrototypeOf(handler).dryRunChanges.apply(handler, [{}]);

          expect(listed).to.equal(false);
          expect(changes).to.deep.equal({ del: [], create: [], conflicts: [], update: [] });
        });

        it('should not report type null on a server that does not hold the type', async () => {
          const changes = await dryRun(
            [holder, plain],
            [
              { name: 'oldAPI', identifier: holder.identifier, type: UCP },
              { name: 'newAPI', identifier: plain.identifier, type: null },
            ]
          );

          expect(changes.update).to.deep.equal([]);
          expect(changes.create).to.deep.equal([]);
        });

        it('should report type null on the holder as a change', async () => {
          const changes = await dryRun(
            [holder, plain],
            [
              { name: 'oldAPI', identifier: holder.identifier, type: null },
              { name: 'newAPI', identifier: plain.identifier },
            ]
          );

          expect(changes.update.map((r) => r.name)).to.deep.equal(['oldAPI']);
        });
      });
    });

    it('should create resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            expect(data.identifier).to.equal('https://api.example.com');
            expect(data.allow_online_access).to.equal(true);
            expect(data.allow_online_access_with_ephemeral_sessions).to.equal(false);
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'https://api.example.com',
              allow_online_access: true,
              allow_online_access_with_ephemeral_sessions: false,
            },
          ],
        },
      ]);
    });

    it('should create resource server with proof_of_possession(mtls)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('mtlsAPI');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'mtls',
              required: true,
            });
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'mtlsAPI',
              identifier: 'https://mtls-api.example.com',
              proof_of_possession: {
                mechanism: 'mtls',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with proof_of_possession(dpop)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('dpopAPI');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: true,
            });
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'dpopAPI',
              identifier: 'https://dpop-api.example.com',
              proof_of_possession: {
                mechanism: 'dpop',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with proof_of_possession and required_for(public_clients)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('dpopAPIWithRequiredFor');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: true,
              required_for: 'public_clients',
            });
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'dpopAPIWithRequiredFor',
              identifier: 'https://dpop-api-required-for.example.com',
              proof_of_possession: {
                mechanism: 'dpop',
                required: true,
                required_for: 'public_clients',
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with proof_of_possession and required_for(all_clients)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('mtlsAPIWithRequiredFor');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'mtls',
              required: true,
              required_for: 'all_clients',
            });
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'mtlsAPIWithRequiredFor',
              identifier: 'https://mtls-api-required-for.example.com',
              proof_of_possession: {
                mechanism: 'mtls',
                required: true,
                required_for: 'all_clients',
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with subject_type_authorization', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('advancedAPI');
            expect(data.subject_type_authorization).to.deep.equal({
              user: {
                policy: 'require_client_grant',
              },
              client: {
                policy: 'deny_all',
              },
            });
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'advancedAPI',
              identifier: 'https://advanced-api.example.com',
              subject_type_authorization: {
                user: {
                  policy: 'require_client_grant',
                },
                client: {
                  policy: 'deny_all',
                },
              },
            },
          ],
        },
      ]);
    });

    it('should get resource servers', async () => {
      const auth0 = {
        resourceServers: {
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              {
                name: 'Auth0 Management API',
                identifier: 'https://test.auth0.com/api/v2/',
              },
              { name: 'Company API', identifier: 'http://company.com/api' },
            ]),
        },
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([{ name: 'Company API', identifier: 'http://company.com/api' }]);
    });

    it('should update resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            expect(id).to.equal('rs1');
            expect(data.scope).to.equal('new:scope');
            expect(data.allow_online_access).to.equal(true);
            expect(data.allow_online_access_with_ephemeral_sessions).to.equal(false);
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              scope: 'new:scope',
              allow_online_access: true,
              allow_online_access_with_ephemeral_sessions: false,
            },
          ],
        },
      ]);
    });

    it('should update resource server with proof_of_possession(mtls)', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            expect(id).to.equal('rs1');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'mtls',
              required: true,
            });
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              proof_of_possession: {
                mechanism: 'mtls',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should update resource server with proof_of_possession(dpop)', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            expect(id).to.equal('rs1');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: false,
            });
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              proof_of_possession: {
                mechanism: 'dpop',
                required: false,
              },
            },
          ],
        },
      ]);
    });

    it('should update resource server with proof_of_possession and required_for', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            expect(id).to.equal('rs1');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: true,
              required_for: 'public_clients',
            });
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              proof_of_possession: {
                mechanism: 'dpop',
                required: true,
                required_for: 'public_clients',
              },
            },
          ],
        },
      ]);
    });

    it('should update new resource server with same name but different identifier', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            expect(data.scope).to.equal('new:scope');
            expect(data.identifier).to.equal('another-api');
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be('undefined');
            expect(data).to.be('undefined');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { resourceServers: [{ name: 'someAPI', identifier: 'another-api', scope: 'new:scope' }] },
      ]);
    });

    it('should update resource server with subject_type_authorization', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            expect(id).to.equal('rs1');
            expect(data.subject_type_authorization).to.deep.equal({
              user: {
                policy: 'allow_all',
              },
              client: {
                policy: 'require_client_grant',
              },
            });
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'advancedAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'advancedAPI',
              identifier: 'some-api',
              subject_type_authorization: {
                user: {
                  policy: 'allow_all',
                },
                client: {
                  policy: 'require_client_grant',
                },
              },
            },
          ],
        },
      ]);
    });

    it('should remove resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.a('string');
            expect(data).to.equal('rs1');
            return Promise.resolve(data);
          },
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [{}] }]);
    });

    it('should remove all resource servers', async () => {
      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.a('string');
            expect(data).to.equal('rs1');
            removed = true;
            return Promise.resolve(data);
          },
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [] }]);
      expect(removed).to.equal(true);
    });

    it('should remove resource servers is run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.a('string');
            expect(data).to.equal('rs1');
            removed = true;
            return Promise.resolve(data);
          },
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not touch excluded resource servers', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          delete: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          list: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
              { id: 'rs2', identifier: 'some-other-api', name: 'someOtherAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [{ name: 'someAPI', identifier: 'some-api', scope: 'new:scope' }],
        exclude: {
          resourceServers: ['someOtherAPI', 'someAPI'],
        },
      };

      await stageFn.apply(handler, [data]);
    });

    it('should preserve client_id as readonly property during updates', async () => {
      let updateCalled = false;
      const existingResourceServer = {
        id: 'rs1',
        identifier: 'some-api',
        name: 'someAPI',
        client_id: 'linked_client_123', // This should be preserved as readonly
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            updateCalled = true;
            expect(data.client_id).to.be.equals(undefined);
            expect(data.name).to.equal('someAPI');
            // identifier is also stripped as it's readonly
            expect(id).to.equal('rs1');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'resourceServers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [
          {
            name: 'someAPI',
            identifier: 'some-api',
            client_id: 'different_client_456', // This should be ignored
          },
        ],
      };

      await stageFn.apply(handler, [data]);
      expect(updateCalled).to.be.equals(true);
    });

    it('should include client_id in resource server export when present', async () => {
      const resourceServerWithClient = {
        id: 'rs1',
        identifier: 'some-api',
        name: 'someAPI',
        client_id: 'linked_client_123',
      };

      const auth0 = {
        resourceServers: {
          list: (params) => mockPagedData(params, 'resourceServers', [resourceServerWithClient]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result).to.be.an('array');
      expect(result[0]).to.have.property('client_id', 'linked_client_123');
      expect(result[0]).to.have.property('name', 'someAPI');
      expect(result[0]).to.have.property('identifier', 'some-api');
    });

    it('should sanitize system resource servers in getType for Auth0 My Account API', async () => {
      const systemResourceServer = {
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        scopes: [{ value: 'read:users' }], // Should be removed
        signing_alg: 'RS256', // Should be removed
        allow_offline_access: true, // Should be removed
        skip_consent_for_verifiable_first_party_clients: true,
        enforce_policies: true, // Should be removed
        token_dialect: 'access_token', // Should be removed
      };

      const auth0 = {
        resourceServers: {
          list: (params) => mockPagedData(params, 'resource_servers', [systemResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal({
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        skip_consent_for_verifiable_first_party_clients: true,
      });
    });

    it('should preserve authorization_policy on system resource server export (getType)', async () => {
      const systemResourceServer = {
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        skip_consent_for_verifiable_first_party_clients: true,
        authorization_policy: { policy_id: '019b76da-a800-73c9-b656-b349ae415c17' },
        scopes: [{ value: 'read:users' }], // Should be removed
        signing_alg: 'RS256', // Should be removed
      };

      const auth0 = {
        resourceServers: {
          list: (params) => mockPagedData(params, 'resource_servers', [systemResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result[0]).to.have.property('authorization_policy');
      expect(result[0].authorization_policy).to.deep.equal({
        policy_id: '019b76da-a800-73c9-b656-b349ae415c17',
      });
      expect(result[0]).to.not.have.property('scopes');
      expect(result[0]).to.not.have.property('signing_alg');
    });

    it('should include authorization_policy in update payload for Auth0 My Account API', async () => {
      let updateCalledWith = null;
      const existingResourceServer = {
        id: 'rs_my_account',
        identifier: 'https://auth0.com/my-account/me/',
        name: 'Auth0 My Account API',
        is_system: true,
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            updateCalledWith = data;
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'resource_servers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'Auth0 My Account API',
              identifier: 'https://auth0.com/my-account/me/',
              authorization_policy: { policy_id: '019b76da-a800-73c9-b656-b349ae415c17' },
            },
          ],
        },
      ]);

      expect(updateCalledWith).to.not.equal(null);
      expect(updateCalledWith.authorization_policy).to.deep.equal({
        policy_id: '019b76da-a800-73c9-b656-b349ae415c17',
      });
    });

    it('should include authorization_policy: null in update payload for Auth0 My Account API (clearing the policy)', async () => {
      let updateCalledWith = null;
      const existingResourceServer = {
        id: 'rs_my_account',
        identifier: 'https://auth0.com/my-account/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        authorization_policy: { policy_id: '019b76da-a800-73c9-b656-b349ae415c17' },
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            updateCalledWith = data;
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'resource_servers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'Auth0 My Account API',
              identifier: 'https://auth0.com/my-account/me/',
              authorization_policy: null,
            },
          ],
        },
      ]);

      expect(updateCalledWith).to.not.equal(null);
      expect(updateCalledWith.authorization_policy).to.equal(null);
    });

    it('should preserve require_consent_non_repudiation on system resource server export (getType)', async () => {
      const systemResourceServer = {
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        skip_consent_for_verifiable_first_party_clients: true,
        require_consent_non_repudiation: true,
        scopes: [{ value: 'read:users' }], // Should be removed
        signing_alg: 'RS256', // Should be removed
      };

      const auth0 = {
        resourceServers: {
          list: (params) => mockPagedData(params, 'resource_servers', [systemResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result[0]).to.have.property('require_consent_non_repudiation');
      expect(result[0].require_consent_non_repudiation).to.equal(true);
      expect(result[0]).to.not.have.property('scopes');
      expect(result[0]).to.not.have.property('signing_alg');
    });

    it('should include require_consent_non_repudiation in update payload for Auth0 My Account API', async () => {
      let updateCalledWith = null;
      const existingResourceServer = {
        id: 'rs_my_account',
        identifier: 'https://auth0.com/my-account/me/',
        name: 'Auth0 My Account API',
        is_system: true,
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            updateCalledWith = data;
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'resource_servers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'Auth0 My Account API',
              identifier: 'https://auth0.com/my-account/me/',
              require_consent_non_repudiation: true,
            },
          ],
        },
      ]);

      expect(updateCalledWith).to.not.equal(null);
      expect(updateCalledWith.require_consent_non_repudiation).to.equal(true);
    });

    it('should update "Auth0 My Account API" without name and is_system', async () => {
      let updateCalled = false;
      const existingResourceServer = {
        id: 'rs_my_account',
        identifier: 'https://auth0.com/my-account/me/',
        name: 'Auth0 My Account API',
        is_system: true,
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            updateCalled = true;
            expect(id).to.equal('rs_my_account');
            expect(data.name).to.equal(undefined);
            expect(data.is_system).to.equal(undefined);
            expect(data.token_lifetime).to.equal(54321);
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'resource_servers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [
          {
            name: 'Auth0 My Account API',
            identifier: 'https://auth0.com/my-account/me/',
            token_lifetime: 54321,
          },
        ],
      };

      await stageFn.apply(handler, [data]);
      expect(updateCalled).to.equal(true);
    });

    it('should update a system resource server other than "Auth0 My Account API" without name', async () => {
      let updateCalled = false;
      const existingResourceServer = {
        id: 'rs_my_organization',
        identifier: 'https://auth0.com/my-organization/my-org/',
        name: 'Auth0 My Organization API',
        is_system: true,
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            updateCalled = true;
            expect(id).to.equal('rs_my_organization');
            expect(data.name).to.equal(undefined);
            expect(data.is_system).to.equal(undefined);
            expect(data.token_lifetime).to.equal(600);
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'resource_servers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [
          {
            name: 'Auth0 My Organization API',
            identifier: 'https://auth0.com/my-organization/my-org/',
            token_lifetime: 600,
          },
        ],
      };

      await stageFn.apply(handler, [data]);
      expect(updateCalled).to.equal(true);
    });
  });
});
