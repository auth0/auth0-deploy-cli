import { expect } from 'chai';
import Auth0 from '../../../src/tools/auth0';
import { Auth0APIClient, Assets } from '../../../src/types';

const mockEmptyClient = {} as Auth0APIClient;
const mockEmptyAssets = {} as Assets;

describe('#Auth0 class', () => {
  describe('#resource exclusion', () => {
    it('should exclude handlers listed in AUTH0_EXCLUDED from Auth0 class', () => {
      const auth0WithoutExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_EXCLUDED: [] };
        return config[key];
      });

      const AUTH0_EXCLUDED = ['rules', 'organizations', 'connections'];
      const auth0WithExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_EXCLUDED };
        return config[key];
      });

      console.log({ auth0WithExclusions });

      expect(auth0WithoutExclusions.handlers.length).to.equal(
        auth0WithExclusions.handlers.length + AUTH0_EXCLUDED.length
      ); // Number of handlers is reduced by number of exclusions

      const areAllExcludedHandlersAbsent = auth0WithExclusions.handlers.some((handler) => {
        return AUTH0_EXCLUDED.includes(handler.type);
      });

      expect(areAllExcludedHandlersAbsent).to.be.false;
    });

    it('should not exclude any handlers if AUTH0_EXCLUDED is undefined', () => {
      const AUTH0_EXCLUDED = undefined;
      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, () => AUTH0_EXCLUDED);

      expect(auth0.handlers.length).to.be.greaterThan(0);
    });
  });

  describe('#resource inclusion', () => {
    it('should include only the handlers listed in AUTH0_INCLUDED_ONLY from Auth0 class', () => {
      const AUTH0_INCLUDED_ONLY = ['rules', 'organizations', 'connections'];
      const auth0WithInclusions = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_INCLUDED_ONLY };
        return config[key];
      });

      expect(auth0WithInclusions.handlers.length).to.equal(AUTH0_INCLUDED_ONLY.length);
    });

    it('should include all handler if AUTH0_INCLUDED_ONLY is undefined', () => {
      const AUTH0_INCLUDED_ONLY = undefined;
      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_INCLUDED_ONLY };
        return config[key];
      });

      expect(auth0.handlers.length).to.be.greaterThan(0);
    });
  });
});
