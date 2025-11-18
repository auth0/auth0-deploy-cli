import { expect } from 'chai';
import { PromisePoolExecutor } from 'promise-pool-executor';
import customDomainsHandler from '../../../../src/tools/auth0/handlers/customDomains';
import { Auth0APIClient } from '../../../../src/types';

const customDomains = [
  {
    domain: 'auth.test-domain.com',
    primary: true,
    status: 'pending_verification',
    type: 'auth0_managed_certs',
    verification: {
      methods: [
        {
          name: 'cname',
          record: 'test-domain-555.edge.tenants.us.auth0.com',
        },
      ],
    },
    tls_policy: 'recommended',
  },
];

describe('#customDomains handler', () => {
  it('should get custom domains', async () => {
    const auth0ApiClientMock = {
      customDomains: {
        list: async () => customDomains,
        create: async () => ({ data: customDomains[0] }),
        update: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({ client: auth0ApiClientMock });
    const data = await handler.load();

    expect(data.customDomains).to.deep.equal(customDomains);
  });

  it('should return null when retrieving domains on unsupported tenant', async () => {
    const auth0ApiClientMock = {
      customDomains: {
        list: async () => {
          throw {
            statusCode: 403,
            message:
              'The account is not allowed to perform this operation, please contact our support team',
          };
        },
        create: async () => {},
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({ client: auth0ApiClientMock });
    const data = await handler.getType();

    expect(data).to.equal(null);
  });

  const unsupportedTenantError = {
    statusCode: 403,
    message:
      'The account is not allowed to perform this operation, please contact our support team',
  };

  it('should handle error gracefully if custom domains not supported by tenant', async () => {
    const auth0ApiClientMock = {
      customDomains: {
        list: async () => {
          throw unsupportedTenantError;
        },
        create: async () => {},
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({ client: auth0ApiClientMock });
    const data = await handler.load();

    expect(data).to.deep.equal({ customDomains: null });
  });

  it('should create custom domains', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [],
        create: async (_args) => {
          didCreateFunctionGetCalled = true;
          expect(_args).to.deep.equal({
            domain: customDomains[0].domain,
            type: customDomains[0].type,
            tls_policy: customDomains[0].tls_policy,
          });
          return customDomains[0];
        },
        update: async () => {
          didUpdateFunctionGetCalled = true;
        },
        delete: async () => {
          didDeleteFunctionGetCalled = true;
        },
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: customDomains });
    expect(didCreateFunctionGetCalled).to.equal(true);
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didUpdateFunctionGetCalled).to.equal(false);
  });

  it('should not error if tenant does not support custom domains and trying to create one', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => {
          throw unsupportedTenantError;
        },
        create: async (_args: unknown) => {
          didCreateFunctionGetCalled = true;
          return customDomains[0];
        },
        update: async () => {
          didUpdateFunctionGetCalled = true;
        },
        delete: async () => {
          didDeleteFunctionGetCalled = true;
        },
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: customDomains });
    expect(didCreateFunctionGetCalled).to.equal(true);
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didUpdateFunctionGetCalled).to.equal(false);
  });

  it('should delete custom domains if AUTH0_ALLOW_DELETE is enabled', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => customDomains,
        create: async () => {
          didCreateFunctionGetCalled = true;
        },
        update: async () => {
          didUpdateFunctionGetCalled = true;
        },
        delete: async () => {
          didDeleteFunctionGetCalled = true;
        },
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: (key) => {
        return { AUTH0_ALLOW_DELETE: true }[key];
      },
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); // The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(true);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });

  it('should not delete custom domains if AUTH0_ALLOW_DELETE is disabled', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => customDomains,
        create: async () => {
          didCreateFunctionGetCalled = true;
        },
        update: async () => {
          didUpdateFunctionGetCalled = true;
        },
        delete: async () => {
          didDeleteFunctionGetCalled = true;
        },
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: (key) => {
        return { AUTH0_ALLOW_DELETE: false }[key];
      },
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); // The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });

  it('should not update custom domains settings because not implemented by Auth0 Node SDK', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [],
        create: async () => {
          didCreateFunctionGetCalled = true;
        },
        update: async () => {
          didUpdateFunctionGetCalled = true;
        },
        delete: async () => {
          didDeleteFunctionGetCalled = true;
        },
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); // The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });

  // Update Functionality Tests
  it('should update custom domains when changes exist', async () => {
    let didUpdateFunctionGetCalled = false;

    const existingCustomDomain = {
      custom_domain_id: 'cd_123',
      domain: 'existing.example.com',
      type: 'auth0_managed_certs',
      status: 'ready',
      tls_policy: 'recommended',
    };

    const updatedCustomDomain = {
      custom_domain_id: 'cd_123',
      domain: 'existing.example.com',
      type: 'auth0_managed_certs',
      tls_policy: 'recommended',
      domain_metadata: { environment: 'production' },
    };

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [existingCustomDomain],
        create: async () => {},
        update: async (args, data) => {
          didUpdateFunctionGetCalled = true;
          expect(args).to.equal('cd_123');
          expect(data).to.deep.equal({
            tls_policy: 'recommended',
            domain_metadata: { environment: 'production' },
          });
          return updatedCustomDomain;
        },
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [updatedCustomDomain] });

    expect(didUpdateFunctionGetCalled).to.equal(true);
  });

  it('should call update with correct parameters and strip update fields', async () => {
    let updateCallData = null;

    const existingCustomDomain = {
      domain: 'test.example.com',
      type: 'auth0_managed_certs',
      status: 'ready',
    };

    const updatedCustomDomainWithExtraFields = {
      domain: 'test.example.com', // should be stripped
      type: 'auth0_managed_certs', // should be stripped
      status: 'ready', // should be stripped
      primary: true, // should be stripped
      verification: { method: 'cname' }, // should be stripped
      verification_method: 'cname', // should be stripped
      tls_policy: 'recommended', // should NOT be stripped
      domain_metadata: { key: 'value' }, // should NOT be stripped
    };

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [existingCustomDomain],
        create: async () => {},
        update: async (args, data) => {
          updateCallData = data;
          return {};
        },
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [updatedCustomDomainWithExtraFields] });

    // Verify that stripped fields are not present
    expect(updateCallData).to.not.have.property('domain');
    expect(updateCallData).to.not.have.property('type');
    expect(updateCallData).to.not.have.property('status');
    expect(updateCallData).to.not.have.property('primary');
    expect(updateCallData).to.not.have.property('verification');
    expect(updateCallData).to.not.have.property('verification_method');

    // Verify that allowed fields are present
    expect(updateCallData).to.have.property('tls_policy', 'recommended');
    expect(updateCallData).to.have.property('domain_metadata');
    expect(updateCallData.domain_metadata).to.deep.equal({ key: 'value' });
  });

  // New Schema Fields Tests
  it('should handle domain_metadata in custom domains', async () => {
    let didCreateFunctionGetCalled = false;
    let createCallArgs = null;

    const customDomainWithMetadata = {
      domain: 'metadata.example.com',
      type: 'auth0_managed_certs',
      domain_metadata: {
        environment: 'test',
        team: 'engineering',
        cost_center: '12345',
      },
    };

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [],
        create: async (args) => {
          didCreateFunctionGetCalled = true;
          createCallArgs = args;
          return customDomainWithMetadata;
        },
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [customDomainWithMetadata] });

    expect(didCreateFunctionGetCalled).to.equal(true);
    expect(createCallArgs).to.have.property('domain_metadata');
    expect(createCallArgs.domain_metadata).to.deep.equal({
      environment: 'test',
      team: 'engineering',
      cost_center: '12345',
    });
  });

  it('should create custom domains with tls_policy field', async () => {
    let didCreateFunctionGetCalled = false;
    let createCallArgs = null;

    const customDomainWithTlsPolicy = {
      domain: 'tls.example.com',
      type: 'auth0_managed_certs',
      tls_policy: 'recommended',
    };

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [],
        create: async (args) => {
          didCreateFunctionGetCalled = true;
          createCallArgs = args;
          return customDomainWithTlsPolicy;
        },
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [customDomainWithTlsPolicy] });

    expect(didCreateFunctionGetCalled).to.equal(true);
    expect(createCallArgs).to.have.property('tls_policy', 'recommended');
  });

  it('should support both tls_policy and domain_metadata together', async () => {
    let didCreateFunctionGetCalled = false;
    let createCallArgs = null;

    const customDomainWithBothFields = {
      domain: 'combined.example.com',
      type: 'auth0_managed_certs',
      tls_policy: 'recommended',
      domain_metadata: {
        environment: 'production',
        owner: 'platform-team',
      },
    };

    const auth0ApiClientMock = {
      customDomains: {
        list: async () => [],
        create: async (args) => {
          didCreateFunctionGetCalled = true;
          createCallArgs = args;
          return customDomainWithBothFields;
        },
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    // @ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [customDomainWithBothFields] });

    expect(didCreateFunctionGetCalled).to.equal(true);
    expect(createCallArgs).to.have.property('tls_policy', 'recommended');
    expect(createCallArgs).to.have.property('domain_metadata');
    expect(createCallArgs.domain_metadata).to.deep.equal({
      environment: 'production',
      owner: 'platform-team',
    });
  });
});
