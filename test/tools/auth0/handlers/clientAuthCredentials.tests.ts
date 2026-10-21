import pageClient from '../../../../src/tools/auth0/client';
import { expect } from 'chai';
import clientAuthCredentials from '../../../../src/tools/auth0/handlers/clientAuthCredentials';
import clientAuthCredentialsPre from '../../../../src/tools/auth0/handlers/clientAuthCredentialsPre';
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

const PEM = '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n';

const pkjClient = (clientId: string, name: string, credNames: string[]) => ({
  client_id: clientId,
  name,
  client_authentication_methods: {
    private_key_jwt: {
      credentials: credNames.map((n) => ({ name: n, pem: PEM, credential_type: 'public_key' })),
    },
  },
});

// Runs processChanges and returns the thrown error, or null if it resolved.
const runProcessChanges = async (handler, assets): Promise<Error | null> => {
  const stageFn = Object.getPrototypeOf(handler).processChanges;
  try {
    await stageFn.apply(handler, [assets]);
    return null;
  } catch (err) {
    return err as Error;
  }
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

    it('should skip clients with no client_authentication_methods in config (deletion handled by pre-handler)', async () => {
      const credListCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => {
              credListCalls.push('list');
              return Promise.resolve([
                { id: 'cred_old', name: 'old-key', credential_type: 'public_key' },
              ]);
            },
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      // order-70 handler should not touch clients that have no client_authentication_methods
      expect(credListCalls).to.have.lengthOf(0);
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

    it('should forward kid and other optional fields to create, omitting null/undefined ones', async () => {
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
              client_id: 'client1',
              name: 'My App',
              client_authentication_methods: {
                private_key_jwt: {
                  credentials: [
                    {
                      name: 'new-key',
                      pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
                      credential_type: 'public_key',
                      kid: 'MY_CUSTOM_KID_VALUE',
                      alg: 'RS256',
                      // explicit false must be forwarded, not dropped as falsy
                      parse_expiry_from_cert: false,
                      // null (e.g. an empty `expires_at:` in YAML) must be dropped, not sent
                      expires_at: null,
                    },
                  ],
                },
              },
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(1);
      const { data } = createCalls[0];
      expect(data.kid).to.equal('MY_CUSTOM_KID_VALUE');
      expect(data.alg).to.equal('RS256');
      // explicit false is a valid value and must be sent, not filtered out
      expect(data).to.have.property('parse_expiry_from_cert', false);
      // null and undefined optional fields must not be sent (Auth0 rejects nulls)
      expect(data).to.not.have.property('expires_at');
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

    const pkjwtMethods = {
      private_key_jwt: {
        credentials: [
          {
            name: 'new-key',
            pem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n',
            credential_type: 'public_key',
          },
        ],
      },
    };

    it('should skip dynamic CIMD clients', async () => {
      const createCalls: any[] = [];
      const client = makeClient({
        clients: {
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
              client_id: 'https://app.example.com/client.json',
              name: 'Dynamic App',
              external_metadata_type: 'cimd',
              external_metadata_created_by: 'client',
              client_authentication_methods: pkjwtMethods,
            },
          ],
        },
      ]);

      expect(createCalls).to.have.lengthOf(0);
    });

    it('should not resolve a client name to a dynamic CIMD client', async () => {
      const createCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'https://app.example.com/client.json',
                name: 'My App',
                external_metadata_type: 'cimd',
                external_metadata_created_by: 'client',
              },
              { client_id: 'client1', name: 'My App' },
            ]),
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
            { client_id: null, name: 'My App', client_authentication_methods: pkjwtMethods },
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

    it('should throw and leave the client untouched when a credential create fails during rotation', async () => {
      const updateCalls: any[] = [];
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          update: (id, data) => {
            updateCalls.push({ id, data });
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: () => Promise.reject(new Error('Invalid public key.')),
            delete: (clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [pkjClient('client1', 'My App', ['new-key'])],
      });

      expect(err).to.be.an('error');
      expect(err!.message).to.include(
        'failed to create credential "new-key" on client "My App": Error: Invalid public key.'
      );
      // Without the fix this cleared client_authentication_methods (client_secret_post fallback)
      expect(updateCalls).to.have.lengthOf(0);
      expect(deleteCalls).to.have.lengthOf(0);
    });

    it('should throw and skip deletes when updating client_authentication_methods fails', async () => {
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          update: () => Promise.reject(new Error('A JWT signing algorithm is required')),
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

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [pkjClient('client1', 'My App', ['new-key'])],
      });

      expect(err).to.be.an('error');
      expect(err!.message).to.include(
        'failed to update client_authentication_methods on client "My App"'
      );
      expect(deleteCalls).to.have.lengthOf(0);
    });

    it('should throw when listing credentials fails', async () => {
      const createCalls: any[] = [];
      const client = makeClient({
        clients: {
          credentials: {
            list: () => Promise.reject(new Error('Forbidden')),
            create: (clientId, data) => {
              createCalls.push(data);
              return Promise.resolve({ id: 'cred_new', name: data.name });
            },
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [pkjClient('client1', 'My App', ['new-key'])],
      });

      expect(err).to.be.an('error');
      expect(err!.message).to.include('failed to list credentials for client "My App"');
      expect(createCalls).to.have.lengthOf(0);
    });

    it('should still process remaining clients and report every failure together', async () => {
      const updateCalls: any[] = [];
      const client = makeClient({
        clients: {
          update: (id, data) => {
            updateCalls.push(id);
            return Promise.resolve({ data });
          },
          credentials: {
            list: (clientId) =>
              clientId === 'client3' ? Promise.reject(new Error('Forbidden')) : Promise.resolve([]),
            create: (clientId, data) =>
              clientId === 'client1'
                ? Promise.reject(new Error('Invalid public key.'))
                : Promise.resolve({ id: `cred_${clientId}`, name: data.name }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [
          pkjClient('client1', 'App One', ['key-1']),
          pkjClient('client2', 'App Two', ['key-2']),
          pkjClient('client3', 'App Three', ['key-3']),
        ],
      });

      expect(updateCalls).to.deep.equal(['client2']);
      expect(err).to.be.an('error');
      expect(err!.message).to.include('2 operation(s) failed');
      expect(err!.message).to.include('failed to create credential "key-1" on client "App One"');
      expect(err!.message).to.include('failed to list credentials for client "App Three"');
    });

    it('should only warn, not throw, when deleting a stale credential fails', async () => {
      const client = makeClient({
        clients: {
          credentials: {
            list: () =>
              Promise.resolve([
                { id: 'cred_keep', name: 'keep-key', credential_type: 'public_key' },
                { id: 'cred_old', name: 'old-key', credential_type: 'public_key' },
              ]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => Promise.reject(new Error('Not Found')),
          },
        },
      });

      const handler = new clientAuthCredentials({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [pkjClient('client1', 'My App', ['keep-key'])],
      });

      expect(err).to.equal(null);
    });
  });
});

describe('#clientAuthCredentialsPre handler', () => {
  describe('#processChanges', () => {
    it('should do nothing when AUTH0_ALLOW_DELETE is false', async () => {
      const credListCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => {
              credListCalls.push('list');
              return Promise.resolve([
                { id: 'cred_old', name: 'old-key', credential_type: 'public_key' },
              ]);
            },
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentialsPre({
        client,
        config: makeConfig({ AUTH0_ALLOW_DELETE: false }),
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      expect(credListCalls).to.have.lengthOf(0);
    });

    it('should do nothing when client has no credentials in Auth0', async () => {
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
            list: () => Promise.resolve([]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (_clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      expect(deleteCalls).to.have.lengthOf(0);
      expect(updateCalls).to.have.lengthOf(0);
    });

    it('should skip clients that have client_authentication_methods in config', async () => {
      const credListCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () => {
              credListCalls.push('list');
              return Promise.resolve([
                { id: 'cred_old', name: 'old-key', credential_type: 'public_key' },
              ]);
            },
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
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

      // pre-handler must not touch clients that still have client_authentication_methods in config
      expect(credListCalls).to.have.lengthOf(0);
    });

    it('should clear client_authentication_methods then delete credentials when field is absent from config', async () => {
      const callOrder: string[] = [];
      const updatePayloads: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (_id, data) => {
            callOrder.push('update');
            updatePayloads.push(data);
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => {
              callOrder.push('delete');
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      // update (clear cam) must come before delete
      expect(callOrder).to.deep.equal(['update', 'delete']);
      expect(updatePayloads[0].client_authentication_methods).to.equal(null);
      expect(updatePayloads[0].token_endpoint_auth_method).to.equal('client_secret_post');
    });

    it('should use token_endpoint_auth_method from config when clearing credentials', async () => {
      const updatePayloads: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: (_id, data) => {
            updatePayloads.push(data);
            return Promise.resolve({ data });
          },
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_old', name: 'old-key', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: () => Promise.resolve({}),
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          clients: [
            {
              client_id: 'client1',
              name: 'My App',
              token_endpoint_auth_method: 'none',
            },
          ],
        },
      ]);

      expect(updatePayloads[0].token_endpoint_auth_method).to.equal('none');
    });

    it('should resolve client_id by name when missing (directory mode)', async () => {
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
            delete: (clientId, credId) => {
              deleteCalls.push({ clientId, credId });
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: null, name: 'My App' }] }]);

      expect(deleteCalls).to.have.lengthOf(1);
      expect(deleteCalls[0].clientId).to.equal('client1');
    });

    it('should delete multiple credentials on a single client', async () => {
      const deleteCalls: any[] = [];

      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'My App' }]),
          update: () => Promise.resolve({ data: {} }),
          credentials: {
            list: () =>
              Promise.resolve([
                { id: 'cred_1', name: 'key-one', credential_type: 'public_key' },
                { id: 'cred_2', name: 'key-two', credential_type: 'public_key' },
              ]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (_clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [{ client_id: 'client1', name: 'My App' }] }]);

      expect(deleteCalls).to.have.members(['cred_1', 'cred_2']);
    });

    it('should throw when listing credentials fails, after processing remaining clients', async () => {
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'App One' },
              { client_id: 'client2', name: 'App Two' },
            ]),
          credentials: {
            list: (clientId) =>
              clientId === 'client1'
                ? Promise.reject(new Error('Forbidden'))
                : Promise.resolve([{ id: 'cred_2', name: 'key-2', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [
          { client_id: 'client1', name: 'App One' },
          { client_id: 'client2', name: 'App Two' },
        ],
      });

      expect(deleteCalls).to.deep.equal(['cred_2']);
      expect(err).to.be.an('error');
      expect(err!.message).to.include('failed to list credentials for client "App One"');
    });

    it('should throw and skip deletes when clearing client_authentication_methods fails', async () => {
      const deleteCalls: any[] = [];
      const client = makeClient({
        clients: {
          update: () => Promise.reject(new Error('Bad Request')),
          credentials: {
            list: () =>
              Promise.resolve([{ id: 'cred_1', name: 'key-1', credential_type: 'public_key' }]),
            create: () => Promise.resolve({ id: 'cred_new' }),
            delete: (clientId, credId) => {
              deleteCalls.push(credId);
              return Promise.resolve({});
            },
          },
        },
      });

      const handler = new clientAuthCredentialsPre({ client, config: makeConfig() });
      const err = await runProcessChanges(handler, {
        clients: [{ client_id: 'client1', name: 'My App' }],
      });

      expect(err).to.be.an('error');
      expect(err!.message).to.include(
        'failed to clear client_authentication_methods on client "My App"'
      );
      expect(deleteCalls).to.have.lengthOf(0);
    });
  });
});
