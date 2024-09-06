import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const rules = require('../../../../src/tools/auth0/handlers/rules');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#rules handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#rules validate', () => {
    it('should not allow same names', async () => {
      const auth0 = {
        rules: {
          getAll: (params) => mockPagedData(params, 'rules', []),
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'newRule',
        },
        {
          name: 'newRule',
        },
      ];

      try {
        await stageFn.apply(handler, [{ rules: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should not allow same order', async () => {
      const auth0 = {
        rules: {
          getAll: (params) => mockPagedData(params, 'rules', []),
        }
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Rule1',
          order: '0',
        },
        {
          name: 'Rule2',
          order: '0',
        },
      ];

      try {
        await stageFn.apply(handler, [{ rules: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include(
          'There are multiple rules for the following stage-order combinations'
        );
      }
    });

    it("should not have a rules' order collision when rules are reordered with future rule set no consecutive", async () => {
      const auth0 = {
        rules: {
          getAll: (params) =>
            mockPagedData(params, 'rules', [
              {
                name: 'Rule1',
                order: 1,
              },
              {
                name: 'Rule2',
                order: 2,
              },
            ]),
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).calcChanges;
      const data = [
        {
          name: 'Rule3',
          order: 2,
        },
        {
          name: 'Rule4',
          order: 4,
        },
      ];

      const output = await stageFn.apply(handler, [{ rules: data }], true);
      const newRulesOrder = [...output.create, ...output.update].map((rule) => rule.order);
      const reorderedRulesOrder = output.reOrder.map((rule) => rule.order);

      //  check if there is no collisions between rules order
      const checker = (arr, target) => target.every((v) => arr.includes(v));
      expect(checker(newRulesOrder, reorderedRulesOrder)).to.be.equal(false);
    });

    it("should not have a rules' order collision when rules are reordered with future rule set consecutive", async () => {
      const auth0 = {
        rules: {
          getAll: (params) =>
            mockPagedData(params, 'rules', [
              {
                name: 'Rule1',
                order: 1,
              },
              {
                name: 'Rule2',
                order: 2,
              },
            ]),
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).calcChanges;
      const data = [
        {
          name: 'Rule3',
          order: 2,
        },
        {
          name: 'Rule4',
          order: 3,
        },
      ];

      const output = await stageFn.apply(handler, [{ rules: data }], true);
      const newRulesOrder = [...output.create, ...output.update].map((rule) => rule.order);
      const reorderedRulesOrder = output.reOrder.map((rule) => rule.order);

      //  check if there is no collisions between rules order
      const checker = (arr, target) => target.every((v) => arr.includes(v));
      expect(checker(newRulesOrder, reorderedRulesOrder)).to.be.equal(false);
    });

    it('should not allow change stage', async () => {
      const auth0 = {
        rules: {
          getAll: (params) =>
            mockPagedData(params, 'rules', [
              {
                name: 'Rule1',
                stage: 'some_stage',
              },
            ]),
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Rule1',
          stage: 'new_stage',
        },
      ];

      try {
        await stageFn.apply(handler, [{ rules: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('The following rules changed stage which is not allowed');
      }
    });

    it('should pass validation', async () => {
      const auth0 = {
        rules: {
          getAll: (params) => mockPagedData(params, 'rules', []),
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'newRule',
        },
      ];

      await stageFn.apply(handler, [{ rules: data }]);
    });
  });

  describe('#rules process', () => {
    it('should create rule', async () => {
      const auth0 = {
        rules: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someRule');
            expect(data.script).to.equal('rule_script');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'rules', []),
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rules: [{ name: 'someRule', script: 'rule_script' }] }]);
    });

    it('should get rules', async () => {
      const script = 'function fake() {};';

      const rulesData = [
        {
          enabled: false,
          name: 'test-rule-1',
          script,
          order: 1,
          stage: 'login_success',
        },
        {
          enabled: false,
          name: 'test-rule-2',
          script,
          order: 2,
          stage: 'login_success',
        },
      ];

      const auth0 = {
        rules: { getAll: (params) => mockPagedData(params, 'rules', rulesData) },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(rulesData);
    });

    it('should not throw if rules endpoint deprecated', async () => {
      const auth0 = {
        rules: {
          getAll: () => {
            const error = new Error();
            error.statusCode = 403;
            error.message = 'Insufficient privileges to use this deprecated feature';
            throw error;
          },
        },
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('should update rule', async () => {
      const auth0 = {
        rules: {
          create: () => Promise.resolve({ data: [] }),
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rule1');
            expect(data.script).to.equal('new_script');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'rules', [{ id: 'rule1', name: 'someRule', script: 'rule_script' }])
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rules: [{ name: 'someRule', script: 'new_script' }] }]);
    });

    it('should remove rule', async () => {
      const auth0 = {
        rules: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rule1');
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'rules', [{ id: 'rule1', name: 'existingRule', order: '10' }])
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rules: [{}] }]);
    });

    it('should remove all rules', async () => {
      let removed = false;
      const auth0 = {
        rules: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rule1');
            removed = true;
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'rules', [{ id: 'rule1', name: 'existingRule', order: '10' }])
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rules: [] }]);
      expect(removed).to.equal(true);
    });

    it('should remove rules if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      let removed = false;
      const auth0 = {
        rules: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rule1');
            removed = true;
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'rules', [{ id: 'rule1', name: 'existingRule', order: '10' }])
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rules: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not touch excluded rules', async () => {
      const auth0 = {
        rules: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          delete: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'rules', [
              { id: 'rule1', script: 'rule-one-script', name: 'Rule1' },
              { id: 'rile2', script: 'some-other-script', name: 'Rule2' },
            ]),
        },
        pool,
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        rules: [
          { name: 'Rule1', script: 'new-rule-one-script' },
          { name: 'Rule3', script: 'new-rule-three-script' },
        ],
        exclude: {
          rules: ['Rule1', 'Rule2', 'Rule3'],
        },
      };

      await stageFn.apply(handler, [data]);
    });

    it('should not throw if attempted to update rules when deprecated for tenant', async () => {
      const auth0 = {
        rules: {
          getAll: () => {
            const error = new Error();
            error.statusCode = 403;
            error.message = 'Insufficient privileges to use this deprecated feature';
            throw error;
          },
        },
        pool,
      };
      const data = {
        rules: [
          { name: 'Rule1', script: 'new-rule-one-script' },
          { name: 'Rule3', script: 'new-rule-three-script' },
        ],
      };

      const handler = new rules.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await expect(stageFn.apply(handler, [data])).to.be.eventually.fulfilled;
    });
  });
});
