const { expect } = require('chai');
const triggers = require('../../../../src/tools/auth0/handlers/triggers');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#triggers handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  describe('#Triggers validate', () => {
    it('should pass validation', async () => {
      const auth0 = {
        actions: {
          triggers: {
            bindings: {
              list: () => Promise.resolve({ data: [] }),
            },
          },
        },
      };

      const handler = new triggers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = {
        'post-login': [{ action_name: 'action-one', display_name: 'display-name' }],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': [],
        'password-reset-post-challenge': [],
      };

      await stageFn.apply(handler, [{ triggers: data }]);
    });
  });

  describe('#triggers process', () => {
    it('should bind a trigger', async () => {
      const triggersBindings = {
        'post-login': [{ action_name: 'action-one', display_name: 'display-name' }],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': [],
        'password-reset-post-challenge': [],
      };

      const auth0 = {
        actions: {
          triggers: {
            list: () =>
              Promise.resolve({ triggers: Object.keys(triggersBindings).map((id) => ({ id })) }),
            bindings: {
              list: (triggerId) => Promise.resolve({ data: triggersBindings[triggerId] || [] }),
              updateMany: () => Promise.resolve([]),
            },
          },
        },
        pool,
        getAllCalled: false,
      };

      const handler = new triggers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ triggers: triggersBindings }]);
    });

    it('should unbind triggers', async () => {
      let timesUpdateTriggerBindingsCalled = 0;

      const existingTriggerBindings = {
        'post-login': [{ action_name: 'action-one', display_name: 'email-user' }],
        'credentials-exchange': [{ action_name: 'action-two', display_name: 'log-to-logger' }],
        'pre-user-registration': [
          { action_name: 'action-three', display_name: 'slack-integration' },
        ],
        'post-user-registration': [{ action_name: 'action-one', display_name: 'email-user' }],
        'post-change-password': [{ action_name: 'action-two', display_name: 'log-to-logger' }],
        'send-phone-message': [{ action_name: 'action-three', display_name: 'slack-integration' }],
        'password-reset-post-challenge': [
          { action_name: 'action-two', display_name: 'log-to-logger' },
        ],
      };

      const auth0 = {
        actions: {
          triggers: {
            list: () =>
              Promise.resolve({
                triggers: Object.keys(existingTriggerBindings).map((id) => ({ id })),
              }),
            bindings: {
              list: (triggerId) =>
                Promise.resolve({ data: existingTriggerBindings[triggerId] || [] }),
              // eslint-disable-next-line camelcase
              updateMany: (triggerId, { bindings }) => {
                expect([
                  'post-login',
                  'credentials-exchange',
                  'pre-user-registration',
                  'post-user-registration',
                  'post-change-password',
                  'send-phone-message',
                  'password-reset-post-challenge',
                ]).to.include(triggerId); // eslint-disable-line camelcase
                expect(bindings).to.be.an('array').that.is.empty; // eslint-disable-line no-unused-expressions
                timesUpdateTriggerBindingsCalled += 1;
                return Promise.resolve([]);
              },
            },
          },
        },
        pool,
        getAllCalled: false,
      };

      const handler = new triggers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          triggers: {
            'post-login': [],
            'credentials-exchange': [],
            'pre-user-registration': [],
            'post-user-registration': [],
            'post-change-password': [],
            'send-phone-message': [],
            'password-reset-post-challenge': [],
          },
        },
      ]);

      expect(timesUpdateTriggerBindingsCalled).to.equal(7);
    });

    it('should not update triggers omitted from configuration', async () => {
      let timesUpdateTriggerBindingsCalled = 0;

      const existingTriggerBindings = {
        'post-login': [
          { action_name: 'action-one', display_name: 'email-user' },
          { action_name: 'action-two', display_name: 'log-to-logger' },
        ],
        'credentials-exchange': [{ action_name: 'action-two', display_name: 'log-to-logger' }],
        'pre-user-registration': [
          { action_name: 'action-three', display_name: 'slack-integration' },
        ],
        'post-user-registration': [{ action_name: 'action-one', display_name: 'email-user' }],
        'post-change-password': [{ action_name: 'action-two', display_name: 'log-to-logger' }],
        'send-phone-message': [{ action_name: 'action-three', display_name: 'slack-integration' }],
        'password-reset-post-challenge': [
          { action_name: 'action-two', display_name: 'log-to-logger' },
        ],
      };

      const updatePayload = [
        {
          display_name: 'log-to-logger',
          ref: {
            type: 'action_name',
            value: 'action-two',
          },
        },
        {
          display_name: 'slack-integration',
          ref: {
            type: 'action_name',
            value: 'action-three',
          },
        },
      ];

      const auth0 = {
        actions: {
          triggers: {
            list: () =>
              Promise.resolve({
                triggers: Object.keys(existingTriggerBindings).map((id) => ({ id })),
              }),
            bindings: {
              list: (triggerId) =>
                Promise.resolve({ data: existingTriggerBindings[triggerId] || [] }),
              // eslint-disable-next-line camelcase
              updateMany: (triggerId, { bindings }) => {
                expect(triggerId).to.equal('post-login');
                expect(bindings).to.deep.equal(updatePayload);
                timesUpdateTriggerBindingsCalled += 1;
                return Promise.resolve(updatePayload);
              },
            },
          },
        },
        pool,
        getAllCalled: false,
      };

      const handler = new triggers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          triggers: {
            'post-login': [
              { action_name: 'action-two', display_name: 'log-to-logger' },
              { action_name: 'action-three', display_name: 'slack-integration' },
            ], // All other triggers omitted
          },
        },
      ]);

      expect(timesUpdateTriggerBindingsCalled).to.equal(1);
    });

    it('should get all triggers', async () => {
      const triggersBindings = {
        'post-login': [{ action_name: 'action-one', display_name: 'display-name' }],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': [],
        'password-reset-post-challenge': [],
      };

      const auth0 = {
        actions: {
          triggers: {
            list: () =>
              Promise.resolve({
                triggers: [
                  { id: 'post-login' },
                  { id: 'credentials-exchange' },
                  { id: 'pre-user-registration' },
                  { id: 'post-user-registration' },
                  { id: 'post-change-password' },
                  { id: 'send-phone-message' },
                  { id: 'password-reset-post-challenge' },
                ],
              }),
            bindings: {
              list: (triggerId) => {
                let res = [];
                switch (triggerId) {
                  case 'post-login':
                    res = [
                      {
                        action: { name: 'action-one' },
                        display_name: 'display-name',
                      },
                    ];
                    break;
                  case 'credentials-exchange':
                  case 'pre-user-registration':
                  case 'post-user-registration':
                  case 'post-change-password':
                  case 'send-phone-message':
                  case 'password-reset-post-challenge':
                    res = [];
                    break;
                  default:
                    break;
                }
                return Promise.resolve({ data: res });
              },
            },
          },
        },
      };

      const handler = new triggers.default({ client: auth0, config });
      const data = await handler.getType();
      expect(triggersBindings).to.deep.include(data);
    });

    it('should return an empty array for 404 status code', async () => {
      const auth0 = {
        actions: {
          triggers: {
            list: () => {
              const error = new Error('Not found');
              error.statusCode = 404;
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new triggers.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should return an empty array when the feature flag is disabled', async () => {
      const auth0 = {
        actions: {
          triggers: {
            list: () => {
              const error = new Error('Not enabled');
              error.statusCode = 403;
              error.originalError = {
                response: {
                  body: {
                    errorCode: 'feature_not_enabled',
                  },
                },
              };
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new triggers.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        actions: {
          triggers: {
            list: () => {
              const error = new Error('Bad request');
              error.statusCode = 500;
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new triggers.default({ client: auth0, config });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });
  });
});
