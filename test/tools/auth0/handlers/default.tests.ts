import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const { expect } = chai;
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
  const config = () => undefined;

  it('should strip designated fields from payload when creating', async () => {
    let didCreateFunctionGetCalled = false;

    const handler = new mockHandler({
      client: mockApiClient,
      config,
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
      config,
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
      config,
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

  it('should throw when creating an asset with an unresolved placeholder', async () => {
    const handler = new mockHandler({
      client: mockApiClient,
      config,
      type: mockAssetType,
      functions: {
        //@ts-ignore
        create: async (payload) => payload,
      },
    });

    await expect(
      handler.processChanges({} as Assets, {
        del: [],
        update: [],
        conflicts: [],
        create: [
          {
            id: 'some-id',
            unresolved_field: '##UNRESOLVED_PLACEHOLDER##',
            resolved_field: 'a-real-value',
          },
        ],
      })
    ).to.be.rejectedWith(/Unresolved placeholder/);
  });

  it('should throw when updating an asset with an unresolved placeholder', async () => {
    const handler = new mockHandler({
      client: mockApiClient,
      config,
      type: mockAssetType,
      functions: {
        //@ts-ignore
        update: async (_identifiers, payload) => payload,
      },
    });

    await expect(
      handler.processChanges({} as Assets, {
        del: [],
        create: [],
        conflicts: [],
        update: [
          {
            id: 'foo',
            secret: '##UNRESOLVED_SECRET##',
            non_sensitive_property: 'regular value',
          },
        ],
      })
    ).to.be.rejectedWith(/Unresolved placeholder/);
  });

  describe('AUTH0_IGNORE_DRY_RUN_FIELDS', () => {
    it('should merge user-configured ignore fields with handler defaults', () => {
      const configWithIgnore = ((key: string) => {
        if (key === 'AUTH0_IGNORE_DRY_RUN_FIELDS') {
          return { [mockAssetType]: ['user.added.field', 'another_user_field'] };
        }
        return undefined;
      }) as any;

      const handler = new mockHandler({
        client: mockApiClient,
        config: configWithIgnore,
        type: mockAssetType,
        ignoreDryRunFields: ['handler.default.field'],
        functions: {},
      });

      expect(handler.getEffectiveIgnoreDryRunFields()).to.have.members([
        'handler.default.field',
        'user.added.field',
        'another_user_field',
      ]);
    });

    it('should dedupe overlapping ignore fields between config and handler defaults', () => {
      const configWithIgnore = ((key: string) => {
        if (key === 'AUTH0_IGNORE_DRY_RUN_FIELDS') {
          return { [mockAssetType]: ['shared.field', 'user.only.field'] };
        }
        return undefined;
      }) as any;

      const handler = new mockHandler({
        client: mockApiClient,
        config: configWithIgnore,
        type: mockAssetType,
        ignoreDryRunFields: ['shared.field', 'handler.only.field'],
        functions: {},
      });

      const effective = handler.getEffectiveIgnoreDryRunFields();
      expect(effective).to.have.members(['shared.field', 'handler.only.field', 'user.only.field']);
      expect(effective.filter((f) => f === 'shared.field')).to.have.length(1);
    });

    it('should ignore config entries for other handler types', () => {
      const configWithIgnore = ((key: string) => {
        if (key === 'AUTH0_IGNORE_DRY_RUN_FIELDS') {
          return { 'some-other-type': ['unrelated.field'] };
        }
        return undefined;
      }) as any;

      const handler = new mockHandler({
        client: mockApiClient,
        config: configWithIgnore,
        type: mockAssetType,
        ignoreDryRunFields: ['handler.default.field'],
        functions: {},
      });

      expect(handler.getEffectiveIgnoreDryRunFields()).to.deep.equal(['handler.default.field']);
    });

    it('should default to handler-only fields when config returns undefined', () => {
      const handler = new mockHandler({
        client: mockApiClient,
        config,
        type: mockAssetType,
        ignoreDryRunFields: ['handler.default.field'],
        functions: {},
      });

      expect(handler.getEffectiveIgnoreDryRunFields()).to.deep.equal(['handler.default.field']);
    });

    it('should tolerate a config provider that throws (e.g. uninitialized configFactory)', () => {
      const throwingConfig = (() => {
        throw new Error('A configuration provider has not been set');
      }) as any;

      const handler = new mockHandler({
        client: mockApiClient,
        config: throwingConfig,
        type: mockAssetType,
        ignoreDryRunFields: ['handler.default.field'],
        functions: {},
      });

      expect(handler.getEffectiveIgnoreDryRunFields()).to.deep.equal(['handler.default.field']);
    });
  });
});
