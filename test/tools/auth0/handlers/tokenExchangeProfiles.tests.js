import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const tokenExchangeProfiles = require('../../../../src/tools/auth0/handlers/tokenExchangeProfiles');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#tokenExchangeProfiles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#tokenExchangeProfiles schema', () => {
    it('should have valid schema', () => {
      expect(tokenExchangeProfiles.schema).to.be.an('object');
      expect(tokenExchangeProfiles.schema.type).to.equal('array');
      expect(tokenExchangeProfiles.schema.items).to.be.an('object');
      expect(tokenExchangeProfiles.schema.items.required).to.include('name');
      expect(tokenExchangeProfiles.schema.items.required).to.include('subject_token_type');
      expect(tokenExchangeProfiles.schema.items.required).to.include('action');
    });
  });

  describe('#tokenExchangeProfiles validate', () => {
    it('should not allow same names', async () => {
      const handler = new tokenExchangeProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'CIS token exchange',
          subject_token_type: 'https://acme.com/cis-token',
          action: 'my-action',
          type: 'custom_authentication',
        },
        {
          name: 'CIS token exchange',
          subject_token_type: 'https://acme.com/other-token',
          action: 'my-action',
          type: 'custom_authentication',
        },
      ];

      try {
        await stageFn.apply(handler, [{ tokenExchangeProfiles: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new tokenExchangeProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'CIS token exchange',
          subject_token_type: 'https://acme.com/cis-token',
          action: 'my-action',
          type: 'custom_authentication',
        },
      ];

      await stageFn.apply(handler, [{ tokenExchangeProfiles: data }]);
    });
  });

  describe('#tokenExchangeProfiles getType', () => {
    it('should get token exchange profiles', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
                created_at: '2024-10-01T16:09:42.725Z',
                updated_at: '2024-10-01T16:09:42.725Z',
              },
            ]),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.be.an('array');
      expect(data).to.have.lengthOf(1);
      expect(data[0].name).to.equal('CIS token exchange');
      expect(data[0].action).to.equal('my-action');
      expect(data[0].action_id).to.be.undefined; // Should be mapped to action name
    });

    it('should return an empty array for 403 status code', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: () => {
            const error = new Error('Feature not enabled');
            error.statusCode = 403;
            throw error;
          },
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should throw error for 404 status code', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Not found');
        expect(err.statusCode).to.equal(404);
      }
    });

    it('should throw error for 501 status code', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: () => {
            const error = new Error('Feature not implemented');
            error.statusCode = 501;
            throw error;
          },
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Feature not implemented');
        expect(err.statusCode).to.equal(501);
      }
    });

    it('should return empty array when profiles list is empty', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () => Promise.resolve({ data: [] }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should propagate unexpected API errors', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: () => {
            throw new Error('Unexpected API error');
          },
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Unexpected API error');
      }
    });
  });

  describe('#tokenExchangeProfiles process', () => {
    it('should create token exchange profile', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('CIS token exchange');
            expect(data.subject_token_type).to.equal('https://acme.com/cis-token');
            expect(data.action_id).to.equal('action_123'); // Should be mapped to action_id
            return Promise.resolve({
              data: {
                ...data,
                id: 'tep_123',
                created_at: '2024-10-01T16:09:42.725Z',
                updated_at: '2024-10-01T16:09:42.725Z',
              },
            });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };
      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          tokenExchangeProfiles: [
            {
              name: 'CIS token exchange',
              subject_token_type: 'https://acme.com/cis-token',
              action: 'my-action',
              type: 'custom_authentication',
            },
          ],
        },
      ]);
    });

    it('should update token exchange profile', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('tep_123');
            expect(data.name).to.equal('Updated token exchange');
            expect(data.subject_token_type).to.equal('https://acme.com/updated-token');
            // Verify that action_id and type are stripped (only name and subject_token_type can be updated)
            expect(data.action_id).to.be.undefined;
            expect(data.type).to.be.undefined;
            return Promise.resolve();
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          tokenExchangeProfiles: [
            {
              id: 'tep_123',
              name: 'Updated token exchange',
              subject_token_type: 'https://acme.com/updated-token',
              action: 'my-action',
              type: 'custom_authentication',
            },
          ],
        },
      ]);
    });

    it('should delete token exchange profile', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('tep_123');
            return Promise.resolve();
          },
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () => Promise.resolve({ data: [] }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ tokenExchangeProfiles: [] }]);
    });

    it('should process deletes before creates to avoid race conditions', async () => {
      const executionOrder = [];
      const auth0 = {
        tokenExchangeProfiles: {
          create: function (data) {
            executionOrder.push('create');
            return Promise.resolve({ data: { ...data, id: 'tep_new' } });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: function (id) {
            executionOrder.push('delete');
            return new Promise((resolve) => setTimeout(() => resolve({ id }), 10));
          },
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'Existing token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool: {
          addEachTask: ({ data, generator }) => ({
            promise: () => Promise.all((data || []).map((item) => generator(item))),
          }),
        },
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          tokenExchangeProfiles: [
            {
              name: 'New token exchange',
              subject_token_type: 'https://acme.com/cis-token',
              action: 'my-action',
              type: 'custom_authentication',
            },
          ],
        },
      ]);

      expect(executionOrder).to.deep.equal(['delete', 'create']);
    });

    it('should throw error when action is not found during create', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [
          {
            tokenExchangeProfiles: [
              {
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action: 'non-existent-action',
                type: 'custom_authentication',
              },
            ],
          },
        ]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('non-existent-action');
        expect(err.message).to.include('not found');
      }
    });

    it('should handle multiple profiles with different actions', async () => {
      const createdProfiles = [];
      const auth0 = {
        tokenExchangeProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            createdProfiles.push(data);
            return Promise.resolve({
              data: {
                ...data,
                id: `tep_${createdProfiles.length}`,
                created_at: '2024-10-01T16:09:42.725Z',
                updated_at: '2024-10-01T16:09:42.725Z',
              },
            });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
                {
                  id: 'action_456',
                  name: 'partner-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          tokenExchangeProfiles: [
            {
              name: 'CIS token exchange',
              subject_token_type: 'https://acme.com/cis-token',
              action: 'my-action',
              type: 'custom_authentication',
            },
            {
              name: 'Partner token exchange',
              subject_token_type: 'https://partner.com/auth-token',
              action: 'partner-action',
              type: 'custom_authentication',
            },
          ],
        },
      ]);

      expect(createdProfiles).to.have.lengthOf(2);
      expect(createdProfiles[0].action_id).to.equal('action_123');
      expect(createdProfiles[1].action_id).to.equal('action_456');
    });

    it('should handle profile with action_id already set', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            // If action_id is already set, it should be preserved
            expect(data.action_id).to.equal('action_123');
            expect(data.action).to.be.undefined;
            return Promise.resolve({
              data: {
                ...data,
                id: 'tep_123',
                created_at: '2024-10-01T16:09:42.725Z',
                updated_at: '2024-10-01T16:09:42.725Z',
              },
            });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          tokenExchangeProfiles: [
            {
              name: 'CIS token exchange',
              subject_token_type: 'https://acme.com/cis-token',
              action_id: 'action_123',
              type: 'custom_authentication',
            },
          ],
        },
      ]);
    });

    it('should not delete when AUTH0_ALLOW_DELETE is false', async () => {
      let deleteCalled = false;
      const auth0 = {
        tokenExchangeProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function () {
            deleteCalled = true;
            return Promise.resolve();
          },
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () => Promise.resolve({ data: [] }),
        },
        pool,
      };

      const configNoDelete = function (key) {
        return configNoDelete.data && configNoDelete.data[key];
      };
      configNoDelete.data = {
        AUTH0_CLIENT_ID: 'client_id',
        AUTH0_ALLOW_DELETE: false,
      };

      const handler = new tokenExchangeProfiles.default({
        client: pageClient(auth0),
        config: configNoDelete,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ tokenExchangeProfiles: [] }]);

      expect(deleteCalled).to.equal(false);
    });

    it('should do nothing if tokenExchangeProfiles is not provided', async () => {
      let createCalled = false;
      let updateCalled = false;
      let deleteCalled = false;

      const auth0 = {
        tokenExchangeProfiles: {
          create: () => {
            createCalled = true;
            return Promise.resolve({ data: [] });
          },
          update: () => {
            updateCalled = true;
            return Promise.resolve({ data: [] });
          },
          delete: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
          list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
        },
        actions: {
          list: () => Promise.resolve({ data: [] }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{}]); // No tokenExchangeProfiles in assets

      expect(createCalled).to.equal(false);
      expect(updateCalled).to.equal(false);
      expect(deleteCalled).to.equal(false);
    });
  });

  describe('#tokenExchangeProfiles action mapping', () => {
    it('should warn when action is not found during export', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_999',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      // Profile should still be returned even if action is not found
      expect(data).to.be.an('array');
      expect(data).to.have.lengthOf(1);
      expect(data[0].action_id).to.equal('action_999'); // Should keep original action_id
      expect(data[0].action).to.be.undefined;
    });

    it('should map multiple profiles with same action correctly', async () => {
      const auth0 = {
        tokenExchangeProfiles: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'tokenExchangeProfiles', [
              {
                id: 'tep_123',
                name: 'CIS token exchange',
                subject_token_type: 'https://acme.com/cis-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
              {
                id: 'tep_456',
                name: 'Partner token exchange',
                subject_token_type: 'https://partner.com/auth-token',
                action_id: 'action_123',
                type: 'custom_authentication',
              },
            ]),
        },
        actions: {
          list: () =>
            Promise.resolve({
              data: [
                {
                  id: 'action_123',
                  name: 'my-action',
                  supported_triggers: [{ id: 'custom-token-exchange', version: 'v1' }],
                },
              ],
            }),
        },
        pool,
      };

      const handler = new tokenExchangeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data).to.be.an('array');
      expect(data).to.have.lengthOf(2);
      expect(data[0].action).to.equal('my-action');
      expect(data[1].action).to.equal('my-action');
      expect(data[0].action_id).to.be.undefined;
      expect(data[1].action_id).to.be.undefined;
    });
  });
});
