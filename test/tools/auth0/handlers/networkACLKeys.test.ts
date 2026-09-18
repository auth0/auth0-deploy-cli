import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';
import sinon from 'sinon';

import NetworkACLKeysHandler, { schema } from '../../../../src/tools/auth0/handlers/networkACLKeys';
import pageClient from '../../../../src/tools/auth0/client';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const sampleKey = {
  id: 'key_123',
  name: 'my-hmac-key',
  alg: 'hmac-sha256' as const,
  fingerprint: 'ee66b47a0b3e356a0d7c587bd1e2ed3790b46fdbd657dbeb409f30de76a14cc3',
};

describe('#networkACLKeys handler', () => {
  const config = function (key: string) {
    return (config as any).data && (config as any).data[key];
  };
  (config as any).data = { AUTH0_ALLOW_DELETE: false };

  // ─── getType ────────────────────────────────────────────────────────────────

  describe('#getType', () => {
    it('should return keys from the API', async () => {
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [sampleKey] }),
          },
        },
      };
      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const result = await handler.getType();
      expect(result).to.deep.equal([sampleKey]);
    });

    it('should return null on 403 (feature not enabled)', async () => {
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.reject(Object.assign(new Error('Forbidden'), { statusCode: 403 })),
          },
        },
      };
      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const result = await handler.getType();
      expect(result).to.equal(null);
    });

    it('should return null on 404', async () => {
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.reject(Object.assign(new Error('Not Found'), { statusCode: 404 })),
          },
        },
      };
      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const result = await handler.getType();
      expect(result).to.equal(null);
    });

    it('should return null on 501', async () => {
      const auth0 = {
        keys: {
          networkAcls: {
            list: () =>
              Promise.reject(Object.assign(new Error('Not Implemented'), { statusCode: 501 })),
          },
        },
      };
      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const result = await handler.getType();
      expect(result).to.equal(null);
    });
  });

  // ─── processChanges ─────────────────────────────────────────────────────────

  describe('#processChanges', () => {
    it('should do nothing when networkACLKeys asset is not set', async () => {
      const handler = new NetworkACLKeysHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const result = await stageFn.apply(handler, [{}]);
      expect(result).to.equal(undefined);
    });
  });

  // ─── createNetworkACLKey ────────────────────────────────────────────────────

  describe('#createNetworkACLKey', () => {
    it('should create a key, log Created, and increment created counter when value is present', async () => {
      let createCalled = false;
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [] }),
            create: (data: any) => {
              createCalled = true;
              expect(data.name).to.equal(sampleKey.name);
              expect(data.value).to.equal('secret-value');
              return Promise.resolve({ ...sampleKey });
            },
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLKeys: [{ ...sampleKey, value: 'secret-value' }] }]);

      expect(createCalled).to.equal(true);
      expect(handler.created).to.equal(1);
    });

    it('should skip creation, not log Created, and not increment counter when value is absent', async () => {
      let createCalled = false;
      const didCreateSpy = sinon.spy();
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [] }),
            create: () => {
              createCalled = true;
              return Promise.resolve({});
            },
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      handler.didCreate = didCreateSpy;
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // key has no `value` field
      await stageFn.apply(handler, [
        { networkACLKeys: [{ name: sampleKey.name, alg: sampleKey.alg }] },
      ]);

      expect(createCalled).to.equal(false, 'API create should not be called');
      expect(didCreateSpy.called).to.equal(false, 'didCreate should not be called');
      expect(handler.created).to.equal(0, 'created counter should stay 0');
    });
  });

  // ─── deleteNetworkACLKey ────────────────────────────────────────────────────

  describe('#deleteNetworkACLKey', () => {
    it('should delete a key when AUTH0_ALLOW_DELETE is true', async () => {
      (config as any).data.AUTH0_ALLOW_DELETE = true;
      let deletedId: string | null = null;
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [sampleKey] }),
            delete: (id: string) => {
              deletedId = id;
              return Promise.resolve();
            },
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLKeys: [] }]);

      expect(deletedId).to.equal(sampleKey.id);
      expect(handler.deleted).to.equal(1);
    });

    it('should not delete a key when AUTH0_ALLOW_DELETE is false', async () => {
      (config as any).data.AUTH0_ALLOW_DELETE = false;
      let deleteCalled = false;
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [sampleKey] }),
            delete: () => {
              deleteCalled = true;
              return Promise.resolve();
            },
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLKeys: [] }]);

      expect(deleteCalled).to.equal(false);
    });

    it('should surface a clear error on 409 (key still referenced by an ACL rule)', async () => {
      (config as any).data.AUTH0_ALLOW_DELETE = true;
      const auth0 = {
        keys: {
          networkAcls: {
            list: () => Promise.resolve({ keys: [sampleKey] }),
            delete: () => Promise.reject(Object.assign(new Error('Conflict'), { statusCode: 409 })),
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ networkACLKeys: [] }]);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('still referenced by one or more ACL rules');
      }
    });
  });

  // ─── dry-run ─────────────────────────────────────────────────────────────────

  describe('#dry-run', () => {
    it('should not show a phantom UPDATE when local config has value/fingerprint that the API never returns', async () => {
      const dryRunConfig = function (key: string) {
        return (dryRunConfig as any).data && (dryRunConfig as any).data[key];
      };
      (dryRunConfig as any).data = { AUTH0_ALLOW_DELETE: false, AUTH0_DRY_RUN: true };

      const auth0 = {
        keys: {
          networkAcls: {
            // Remote returns key without value (write-only) and without timestamps
            list: () =>
              Promise.resolve({
                keys: [
                  {
                    id: sampleKey.id,
                    name: sampleKey.name,
                    alg: sampleKey.alg,
                    fingerprint: sampleKey.fingerprint,
                  },
                ],
              }),
          },
        },
        pool,
      };

      const handler = new NetworkACLKeysHandler({
        client: pageClient(auth0 as any),
        config: dryRunConfig,
      } as any);

      // Local config has value + fingerprint — these fields must be ignored in the diff
      const changes = await handler.calcChanges({
        networkACLKeys: [
          {
            name: sampleKey.name,
            alg: sampleKey.alg,
            value: 'secret-material',
            fingerprint: sampleKey.fingerprint,
          },
        ],
      } as any);

      expect(changes.update).to.have.lengthOf(
        0,
        'value/fingerprint should not cause phantom UPDATE'
      );
      expect(changes.create).to.have.lengthOf(0);
    });
  });

  // ─── schema ──────────────────────────────────────────────────────────────────

  describe('#schema', () => {
    const Ajv = require('ajv');
    const ajv = new Ajv({ useDefaults: true, nullable: true });

    it('should pass schema validation with name and alg only', () => {
      const valid = ajv.validate(schema, [{ name: 'my-key', alg: 'hmac-sha256' }]);
      expect(valid).to.equal(true);
      expect(ajv.errors).to.be.null;
    });

    it('should pass schema validation with value and fingerprint', () => {
      const valid = ajv.validate(schema, [
        {
          name: 'my-key',
          alg: 'hmac-sha256',
          value: 'secret',
          fingerprint: sampleKey.fingerprint,
        },
      ]);
      expect(valid).to.equal(true);
      expect(ajv.errors).to.be.null;
    });

    it('should fail schema validation for unknown alg', () => {
      const valid = ajv.validate(schema, [{ name: 'my-key', alg: 'rsa-256' }]);
      expect(valid).to.equal(false);
    });

    it('should fail schema validation when name is missing', () => {
      const valid = ajv.validate(schema, [{ alg: 'hmac-sha256' }]);
      expect(valid).to.equal(false);
    });
  });
});
