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
  it('should strip designated fields from payload when creating', async () => {
    let didCreateFunctionGetCalled = false;

    const handler = new mockHandler({
      client: mockApiClient,
      stripCreateFields: ['stripThisFromCreate', 'stripObjectFromCreate.nestedProperty'],
      type: mockAssetType,
      functions: {
        //@ts-ignore
        create: async (payload) => {
          didCreateFunctionGetCalled = true;
          expect(payload).to.deep.equal({
            id: 'some-id',
            stripObjectFromCreate: {},
            shouldNotSTripFromCreate: 'this property should be untouched',
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
          stripThisFromCreate: 'strip this from the create payload',
          stripObjectFromCreate: {
            nestedProperty: 'also strip this from the create payload',
          },
          shouldNotSTripFromCreate: 'this property should be untouched',
        },
      ],
    });
    expect(didCreateFunctionGetCalled).to.equal(true);
  });
});
