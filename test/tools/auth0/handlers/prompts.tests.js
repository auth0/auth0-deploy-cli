const { expect } = require('chai');
const prompts = require('../../../../src/tools/auth0/handlers/prompts');

describe('#prompts handler', () => {
  describe('#prompts process', () => {
    it('should get prompts', async () => {
      const auth0 = {
        prompts: {
          getSettings: () => ({
            universal_login_experience: 'new',
          }),
        },
      };

      const handler = new prompts.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        universal_login_experience: 'new',
      });
    });

    it('should update prompts settings', async () => {
      const auth0 = {
        prompts: {
          updateSettings: (params, data) => {
            expect(data).to.be.an('object');
            expect(data.universal_login_experience).to.equal('new');
            return Promise.resolve(data);
          },
        },
      };

      const handler = new prompts.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ prompts: { universal_login_experience: 'new' } }]);
    });
  });
});
