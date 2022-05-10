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
        getAll: async () => customDomains,
        create: async () => customDomains[0],
        update: async () => {},
        delete: async () => {},
      },
      pool: new PromisePoolExecutor({
        concurrencyLimit: 3,
        frequencyLimit: 8,
        frequencyWindow: 1000, // 1 sec
      }),
    };

    //@ts-ignore
    const handler = new customDomainsHandler({ client: auth0ApiClientMock });
    const data = await handler.load();

    expect(data).to.deep.equal({ customDomains });
  });

  it('should create custom domains', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        getAll: async () => [],
        create: async (args) => {
          didCreateFunctionGetCalled = true;
          expect(args).to.deep.equal({
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

    //@ts-ignore
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
        getAll: async () => customDomains,
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

    //@ts-ignore
    const handler = new customDomainsHandler({
      config: (key) => {
        return { AUTH0_ALLOW_DELETE: true }[key];
      },
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); //The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(true);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });

  it('should not delete custom domains if AUTH0_ALLOW_DELETE is disabled', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        getAll: async () => customDomains,
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

    //@ts-ignore
    const handler = new customDomainsHandler({
      config: (key) => {
        return { AUTH0_ALLOW_DELETE: false }[key];
      },
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); //The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });

  it('should not update custom domains settings because not implemented by Auth0 Node SDK', async () => {
    let didCreateFunctionGetCalled = false;
    let didUpdateFunctionGetCalled = false;
    let didDeleteFunctionGetCalled = false;

    const auth0ApiClientMock = {
      customDomains: {
        getAll: async () => [],
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

    //@ts-ignore
    const handler = new customDomainsHandler({
      config: () => {},
      client: auth0ApiClientMock as unknown as Auth0APIClient,
    });

    await handler.processChanges({ customDomains: [] });
    expect(didUpdateFunctionGetCalled).to.equal(false); //The update function should not be called
    expect(didDeleteFunctionGetCalled).to.equal(false);
    expect(didCreateFunctionGetCalled).to.equal(false);
  });
});
