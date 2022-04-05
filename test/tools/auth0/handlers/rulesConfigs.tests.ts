import { expect } from 'chai';
import rulesConfigs from '../../../../src/tools/auth0/handlers/rulesConfigs'

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#rulesConfigs handler', () => {
  describe('#rulesConfigs process', () => {
    it('should set rulesConfig', async () => {
      const auth0 = {
        rulesConfigs: {
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.key).to.equal('someKey');
            expect(data.value).to.equal('some_value');
            return Promise.resolve(params);
          }
        },
        pool
      };

      const handler = new rulesConfigs({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { rulesConfigs: [ { key: 'someKey', value: 'some_value' } ] } ]);
    });
  });

  it('should get rules configs', async () => {
    const rulesConfigData = [
      { key: 'SOME_SECRET' },
      { key: 'SOME_OTHER_SECRET' }
    ];

    const auth0 = {
      rulesConfigs: { getAll: () => rulesConfigData }
    };

    const handler = new rulesConfigs({ client: auth0 });
    const data = await handler.getType();
    expect(data).to.deep.equal(rulesConfigData);
  });
});
