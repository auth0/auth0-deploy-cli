import pageClient from '../../../../src/tools/auth0/client';
import { expect } from 'chai';
import clientAuthCredentials from '../../../../src/tools/auth0/handlers/clientAuthCredentials';
import { mockPagedData } from '../../../utils';

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

const makeConfig = (overrides = {}) => {
  const data = { AUTH0_CLIENT_ID: 'mgmt_client', AUTH0_ALLOW_DELETE: true, ...overrides };
  const fn = (key) => data[key];
  return fn;
};

const makeClient = (overrides: any = {}) => {
  const base = {
    clients: {
      list: (params) =>
        mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
      update: () => Promise.resolve({ data: {} }),
      credentials: {
        list: () => Promise.resolve([]),
        create: () => Promise.resolve({ id: 'cred_new', name: 'new-key' }),
        delete: () => Promise.resolve({}),
      },
    },
    pool,
  };

  return pageClient({
    ...base,
    ...overrides,
    clients: { ...base.clients, ...(overrides.clients || {}) },
  });
};

describe('#clientAuthCredentials handler', () => {
  describe('#processChanges', () => {
    it('should not create or delete when no client_authentication_methods and Auth0 has no credentials', async () => {
      const createCalls: any[] = [];
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => Promise.resolve([]),
            create: (_id, data) => {
              createCalls.push(data);
              return Promise.resolve({ id: 'cred_new' });
            },
            delete: (_id, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      expect(createCalls).to.have.lengthOf(0);
      expect(deleteCalls).to.have.lengthOf(0);
    });

    it('should delete credentials when client_authentication_methods is absent and Auth0 has credentials', async () => {
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (_clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      expect(deleteCalls).to.deep.equal(['cred_old']);
    });

    it('should skip all reconciliation when no credential has a pem field, even if Auth0 has existing credentials', async () => {
      const createCalls: any[] = [];
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => Promise.resolve([]),
            create: (clientId, data) => {
              createCalls.push(data);
              return Promise.resolve({ id: 'cred_new' });
            },
            delete: (clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: { credentials: [{ id: 'cred_abc', name: 'old-key' }] },
              },
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(0);
      expect(deleteCalls).to.have.lengthOf(0);
    });

    it('should create credential when pem is present and name is new', async () => {
      const createCalls: any[] = [];
      const updateCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (id, data) => {
            updateCalls.push({ id, data });
            return Promise.resolve({ data });
          },
          credentials: {
            list: () => Promise.resolve([]),
            create: (clientId, data) => {
              createCalls.push({ clientId, data });
              return Promise.resolve({ id: 'cred_new123', name: data.name });
            },
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(1);
      expect(createCalls[0].clientId).to.equal('client1');
      expect(createCalls[0].data.name).to.equal('new-key');
      expect(createCalls[0].data.pem).to.include('BEGIN PUBLIC KEY');
      expect(updateCalls).to.have.lengthOf(1);
      expect(
        updateCalls[0].data.client_authentication_methods.private_key_jwt.credentials
      ).to.deep.equal([{ id: 'cred_new123' }]);
    });

    it('should resolve client_id by name when client_id is null (directory mode)', async () => {
      const createCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => Promise.resolve([]),
            create: (clientId, data) => {
              createCalls.push({ clientId, data });
              return Promise.resolve({ id: 'cred_new123', name: data.name });
            },
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: null,
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(1);
      expect(createCalls[0].clientId).to.equal('client1');
    });

    it('should not delete credentials when AUTH0_ALLOW_DELETE is false', async () => {
      const deleteCalls: any[] = [];
      const updateCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (id, data) => {
            updateCalls.push({ id, data });
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: (clientId, data) => Promise.resolve({ id: 'cred_new', name: data.name }),
            delete: (clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({
        client,
        config: makeConfig({ AUTH0_ALLOW_DELETE: false }),
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(deleteCalls).to.have.lengthOf(0);
    });

    it('should delete stale credentials when AUTH0_ALLOW_DELETE is true, after updating client_authentication_methods', async () => {
      const callOrder: string[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (id, data) => {
            callOrder.push('update');
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: (clientId, data) => {
              callOrder.push('create');
              return Promise.resolve({ id: 'cred_new', name: data.name });
            },
            delete: () => {
              callOrder.push('delete');
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      // create → update → delete order is critical
      expect(callOrder).to.deep.equal(['create', 'update', 'delete']);
    });

    it('should skip reconciliation when credentials array is empty (no pem present)', async () => {
      const deleteCalls: any[] = [];
      const updateCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (id, data) => {
            updateCalls.push(data);
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (_clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: { credentials: [] },
              },
            },
          ],
        },
      ]);

      // empty credentials = no pem = skip reconciliation; existing Auth0 credentials untouched
      expect(deleteCalls).to.have.lengthOf(0);
      expect(updateCalls).to.have.lengthOf(0);
    });

    it('should skip client with duplicate credential names in Auth0', async () => {
      const createCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () =>
              Promise.resolve([
                { id: 'cred_1', name: 'dup-key', credential_type: 'public_key' },
                { id: 'cred_2', name: 'dup-key', credential_type: 'public_key' },
              ]),
            create: (clientId, data) => {
              createCalls.push(data);
              return Promise.resolve({ id: 'cred_new' });
            },
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(0);
    });

    it('should correctly attribute multiple created credentials to their methods', async () => {
      const updateCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (id, data) => {
            updateCalls.push(data);
            return Promise.resolve({ data });
          },
          credentials: {
            list: () => Promise.resolve([]),
            create: (clientId, data) =>
              Promise.resolve({ id: `cred_${data.name}`, name: data.name }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'key-a',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                    {
                      name: 'key-b',
                      pem: '-----BEGIN PUBLIC KEY-----\ndef\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(updateCalls).to.have.lengthOf(1);
      const creds = updateCalls[0].client_authentication_methods.private_key_jwt.credentials;
      expect(creds).to.have.lengthOf(2);
      const ids = creds.map((c) => c.id);
      expect(ids).to.include('cred_key-a');
      expect(ids).to.include('cred_key-b');
    });
  });
});
