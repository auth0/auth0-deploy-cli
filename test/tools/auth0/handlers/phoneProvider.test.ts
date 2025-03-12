import { expect } from 'chai';

import phoneProviderHandler from '../../../../src/tools/auth0/handlers/phoneProvider';

const mockProviders = {
  providers: [{
    disabled: false,
    name: 'twilio',
    configuration:{
      sid: 'twilio_sid',
      default_from: '++15673812247',
      delivery_methods: ['text', 'voice']
    }
  }],
};

describe('#phoneProviders handler', () => {
  describe('#phoneProviders getType', () => {
    it('should get phoneProviders', async () => {
      const auth0 = {
        branding: {
          getAllPhoneProviders: () => Promise.resolve({ data: mockProviders }),
        },
      };

      const handler = new phoneProviderHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal(mockProviders.providers);
    });

    it('should return empty array if there are no phone providers', async () => {
      const auth0 = {
        branding: {
          getAllPhoneProviders: () => Promise.resolve({ data: { providers: [] } }),
        },
      };

      const handler = new phoneProviderHandler({ client: auth0 });
      const data = await handler.getType();

      expect(data).to.deep.equal([]);
    });

    // it('should fail for unexpected api errors', async () => {
    //   let sandbox: sinon.SinonSandbox;
    //   const error = {
    //     statusCode: 400,
    //     message:
    //       'This feature requires at least one custom domain to be configured for the tenant.',
    //   };
    //
    //   const auth0 = {
    //     branding: {
    //       getAllPhoneProviders: sandbox.stub().rejects(
    //         Promise.reject(error)
    //       ),
    //     },
    //   };
    //
    //   const handler = new phoneProviderHandler({ client: auth0 });
    //   const data = await handler.getType().to.be.rejectedWith('Unexpected error');
    //
    //   expect(data).to.deep.equal([]);
    // });
  });

  describe('#phoneProviders process', () => {
    it('should configure phone provider', async () => {

      const auth0 = {
        branding: {
          getAllPhoneProviders: () => Promise.resolve({ data: { providers: [] } }),
          configurePhoneProvider: (data) => Promise.resolve({ data }),
        },

      };

      const handler = new phoneProviderHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ phoneProviders: mockProviders.providers }]);
    });

    // it('should update phone provider', async () => {
    //   const auth0 = {
    //     branding: {
    //       getAllPhoneProviders:() => Promise.resolve(({
    //         data: { providers: [{ id : 'pro_5nbdb4pWifFdA1rV6pW6BE' }] } })),
    //       updatePhoneProvider: (data) => {
    //         expect(data).to.be.an('object');
    //         expect(data.name).to.equal('custom');
    //         expect(data.configuration.delivery_methods).to.equal(['text']);
    //         return Promise.resolve({ data });
    //       },
    //     },
    //   };
    //
    //   const handler = new phoneProviderHandler({ client: auth0 });
    //   const stageFn = Object.getPrototypeOf(handler).processChanges;
    //   const data =  [{
    //     name: 'custom',
    //     disabled: false,
    //     configuration:{
    //       delivery_methods: ['text']
    //     }
    //   }];
    //
    //   await stageFn.apply(handler, [{ phoneProviders: data }]);
    // });

    it('should delete the phone provider when provider exists and AUTH0_ALLOW_DELETE is true', async () => {
      const AUTH0_ALLOW_DELETE = true;

      const auth0 = {
        branding: {
          getAllPhoneProviders: () => Promise.resolve({ data: mockProviders }),
          deletePhoneProvider: () => Promise.resolve({ data: null }),
        },
      };

      const handler = new phoneProviderHandler({
        client: auth0,
        config: () => AUTH0_ALLOW_DELETE,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ phoneProviders: [] }]);
    });

  });
});
