const { expect } = require('chai');
import { PromisePoolExecutor } from 'promise-pool-executor';
import mockHandler from '../../../../src/tools/auth0/handlers/default';
import constants from '../../../../src/tools/constants';
import { Assets, Auth0APIClient } from '../../../../src/types';

const mockAssetType = 'mock-resource-type';

//@ts-ignore
const mockApiClient = {
  [`${mockAssetType}`]: {
    //@ts-ignore
    delete: async ({ _id }, data) => {
      return data;
    },
    //@ts-ignore
    create: async ({ _id }, data) => {
      return data;
    },
    //@ts-ignore
    update: async ({ _id }, data) => {
      return data;
    },
  },
  pool: new PromisePoolExecutor({
    concurrencyLimit: 100,
    frequencyLimit: 3,
    frequencyWindow: 1000, // 1 sec
  }),
} as Auth0APIClient;

describe('#default handler', () => {
  it('should fetch data and obfuscate sensitive values', async () => {
    //@ts-ignore because missing lots of required properties
    const handler = new mockHandler({
      sensitiveFieldsToObfuscate: ['secret', 'auth_key'],
      type: 'mock-resource-type',
    });

    //Mock Auth0 API call
    handler.getType = async () => ({
      secret: 'foo-bar', //This should be obfuscated
      auth_key: 'auth key', //This should be obfuscated
      non_sensitive_property: 'regular value', //This should NOT be obfuscated
    });

    const data = await handler.load();

    expect(data[handler.type]).to.deep.equal({
      secret: constants.OBFUSCATED_SECRET_VALUE,
      auth_key: constants.OBFUSCATED_SECRET_VALUE,
      non_sensitive_property: 'regular value',
    });
  });

  it('should strip obfuscated data fields when making updates', async () => {
    //@ts-ignore because missing lots of required properties
    let didUpdateFunctionGetCalled = false;

    const handler = new mockHandler({
      client: mockApiClient,
      sensitiveFieldsToObfuscate: ['secret', 'auth_key'],
      type: mockAssetType,
      functions: {
        //@ts-ignore
        update: async (_identifiers, payload) => {
          didUpdateFunctionGetCalled = true;
          expect(payload).to.deep.equal({
            //`auth` property stripped
            //`secret` property stripped
            non_sensitive_property: 'regular value',
          });
          return payload;
        },
      },
    });

    await handler.processChanges({} as Assets, {
      del: [],
      create: [],
      conflicts: [],
      update: [
        {
          id: 'foo',
          non_sensitive_property: 'regular value', //This should NOT be obfuscated
          secret: constants.OBFUSCATED_SECRET_VALUE, //This should be obfuscated
          auth_key: constants.OBFUSCATED_SECRET_VALUE, //This should be obfuscated
        },
      ],
    });
    expect(didUpdateFunctionGetCalled).to.equal(true);
  });

  it('should strip obfuscated data fields when creating assets', async () => {
    //@ts-ignore because missing lots of required properties
    let didCreateFunctionGetCalled = false;

    const handler = new mockHandler({
      client: mockApiClient,
      sensitiveFieldsToObfuscate: ['secret', 'auth_key'],
      type: mockAssetType,
      functions: {
        //@ts-ignore
        create: async (payload) => {
          didCreateFunctionGetCalled = true;
          expect(payload).to.deep.equal({
            //`auth` property stripped
            //`secret` property stripped
            id: 'some-id',
            non_sensitive_property: 'regular value',
          });
          return payload;
        },
      },
    });

    await handler.processChanges({} as Assets, {
      del: [],
      update: [],
      conflicts: [],
      create: [
        {
          id: 'some-id',
          non_sensitive_property: 'regular value', //This should NOT be obfuscated
          secret: constants.OBFUSCATED_SECRET_VALUE, //This should be obfuscated
          auth_key: constants.OBFUSCATED_SECRET_VALUE, //This should be obfuscated
        },
      ],
    });
    expect(didCreateFunctionGetCalled).to.equal(true);
  });
});
