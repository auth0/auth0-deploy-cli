import { expect } from 'chai';
import Auth0 from '../../../src/tools/auth0'
import { Auth0APIClient, Assets } from '../../../src/types'

const mockEmptyClient = {} as Auth0APIClient
const mockEmptyAssets = {} as Assets

describe("#Auth0 class", () => {

    describe("#resource exclusion", () => {
        it('should exclude handlers listed in AUTH0_EXCLUDED from Auth0 class', () => {

            const auth0WithoutExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, () => []);

            const AUTH0_EXCLUDED = ['rules', 'organizations', 'connections']
            const auth0WithExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, () => AUTH0_EXCLUDED);

            expect(auth0WithoutExclusions.handlers.length).to.equal(auth0WithExclusions.handlers.length + AUTH0_EXCLUDED.length) // Number of handlers is reduced by number of exclusions

            const areAllExcludedHandlersAbsent = auth0WithExclusions.handlers.some((handler) => {
                return AUTH0_EXCLUDED.includes(handler.type)
            })

            expect(areAllExcludedHandlersAbsent).to.be.false;
        })

        it('should not exclude any handlers if AUTH0_EXCLUDED is undefined', () => {
            const AUTH0_EXCLUDED = undefined
            const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, () => AUTH0_EXCLUDED);

            expect(auth0.handlers.length).to.be.greaterThan(0)
        })
    })
})