import { expect } from 'chai';
import supplementalSignalsHandler, {
  schema,
} from '../../../../src/tools/auth0/handlers/supplementalSignals';

describe('#supplementalSignals handler', () => {
  describe('#supplementalSignals validate', () => {
    it('should not throw error if supplementalSignals is not set', async () => {
      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: {} });
      const stageFn = Object.getPrototypeOf(handler).validate;

      await stageFn.apply(handler, [{}]);
      // No error expected
    });

    it('should not throw error for valid supplementalSignals', async () => {
      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: {} });
      const stageFn = Object.getPrototypeOf(handler).validate;

      await stageFn.apply(handler, [
        {
          supplementalSignals: {
            akamai_enabled: true,
          },
        },
      ]);
      // No error expected
    });
  });

  describe('#supplementalSignals getType', () => {
    it('should get supplementalSignals', async () => {
      const auth0 = {
        supplementalSignals: {
          get: () =>
            Promise.resolve({
              akamai_enabled: true,
            }),
        },
      };

      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        akamai_enabled: true,
      });
    });

    it('should get supplementalSignals with false value', async () => {
      const auth0 = {
        supplementalSignals: {
          get: () =>
            Promise.resolve({
              akamai_enabled: false,
            }),
        },
      };

      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        akamai_enabled: false,
      });
    });
  });

  describe('#supplementalSignals processChanges', () => {
    it('should update supplementalSignals settings', async () => {
      const auth0 = {
        supplementalSignals: {
          get: () =>
            Promise.resolve({
              akamai_enabled: false,
            }),
          patch: (data: any) => {
            expect(data).to.be.an('object');
            expect(data.akamai_enabled).to.equal(true);
            return Promise.resolve(data);
          },
        },
      };

      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          supplementalSignals: {
            akamai_enabled: true,
          },
        },
      ]);
    });

    it('should not update if supplementalSignals is not set', async () => {
      let updateCalled = false;
      const auth0 = {
        supplementalSignals: {
          get: () =>
            Promise.resolve({
              akamai_enabled: false,
            }),
          patch: () => {
            updateCalled = true;
            return Promise.resolve({});
          },
        },
      };

      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
      expect(updateCalled).to.equal(false);
    });

    it('should handle disabling akamai', async () => {
      const auth0 = {
        supplementalSignals: {
          get: () =>
            Promise.resolve({
              akamai_enabled: true,
            }),
          patch: (data: any) => {
            expect(data).to.be.an('object');
            expect(data.akamai_enabled).to.equal(false);
            return Promise.resolve(data);
          },
        },
      };

      // @ts-ignore
      const handler = new supplementalSignalsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          supplementalSignals: {
            akamai_enabled: false,
          },
        },
      ]);
    });
  });

  describe('#supplementalSignals schema validation', () => {
    it('should have correct schema structure', () => {
      expect(schema).to.be.an('object');
      expect(schema.type).to.equal('object');
      expect(schema.properties).to.have.property('akamai_enabled');
      expect(schema.properties.akamai_enabled.type).to.equal('boolean');
    });
  });
});
