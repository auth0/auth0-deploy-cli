import { expect } from 'chai';

import BrandingHandler from '../../../../src/tools/auth0/handlers/branding';

const mockConfig = () => false;

describe('#branding handler', () => {
  describe('#processChanges', () => {
    it('should preserve existing colors when config has no colors', async () => {
      let updatePayload: object | null = null;

      const auth0 = {
        branding: {
          get: () =>
            Promise.resolve({
              logo_url: 'https://example.com/old-logo.svg',
              colors: { primary: '#FF0000', page_background: '#FFFFFF' },
            }),
          update: (data) => {
            updatePayload = data;
            return Promise.resolve(data);
          },
          templates: {
            getUniversalLogin: () => Promise.resolve({ body: '<html></html>' }),
          },
        },
        customDomains: {
          list: () => Promise.resolve([]),
        },
      };

      const handler = new BrandingHandler({ client: auth0, config: mockConfig } as any);
      await handler.load();

      await handler.processChanges({
        branding: { logo_url: 'https://example.com/new-logo.svg' },
      });

      expect(updatePayload).to.deep.equal({
        logo_url: 'https://example.com/new-logo.svg',
        colors: { primary: '#FF0000', page_background: '#FFFFFF' },
      });
    });

    it('should use config colors when provided, not existing', async () => {
      let updatePayload: object | null = null;

      const auth0 = {
        branding: {
          get: () =>
            Promise.resolve({
              logo_url: 'https://example.com/old-logo.svg',
              colors: { primary: '#FF0000', page_background: '#FFFFFF' },
            }),
          update: (data) => {
            updatePayload = data;
            return Promise.resolve(data);
          },
          templates: {
            getUniversalLogin: () => Promise.resolve({ body: '<html></html>' }),
          },
        },
        customDomains: {
          list: () => Promise.resolve([]),
        },
      };

      const handler = new BrandingHandler({ client: auth0, config: mockConfig } as any);
      await handler.load();

      await handler.processChanges({
        branding: {
          logo_url: 'https://example.com/new-logo.svg',
          colors: { primary: '#00FF00', page_background: '#000000' },
        },
      });

      expect(updatePayload).to.deep.equal({
        logo_url: 'https://example.com/new-logo.svg',
        colors: { primary: '#00FF00', page_background: '#000000' },
      });
    });

    it('should not add colors if neither config nor existing has colors', async () => {
      let updatePayload: object | null = null;

      const auth0 = {
        branding: {
          get: () =>
            Promise.resolve({
              logo_url: 'https://example.com/old-logo.svg',
            }),
          update: (data) => {
            updatePayload = data;
            return Promise.resolve(data);
          },
          templates: {
            getUniversalLogin: () => Promise.resolve({ body: '<html></html>' }),
          },
        },
        customDomains: {
          list: () => Promise.resolve([]),
        },
      };

      const handler = new BrandingHandler({ client: auth0, config: mockConfig } as any);
      await handler.load();

      await handler.processChanges({
        branding: { logo_url: 'https://example.com/new-logo.svg' },
      });

      expect(updatePayload).to.deep.equal({
        logo_url: 'https://example.com/new-logo.svg',
      });
    });

    it('should do nothing if branding is not in assets', async () => {
      let updateCalled = false;

      const auth0 = {
        branding: {
          get: () => Promise.resolve({}),
          update: () => {
            updateCalled = true;
            return Promise.resolve({});
          },
          templates: {
            getUniversalLogin: () => Promise.resolve({ body: '<html></html>' }),
          },
        },
        customDomains: {
          list: () => Promise.resolve([]),
        },
      };

      const handler = new BrandingHandler({ client: auth0, config: mockConfig } as any);
      await handler.load();

      await handler.processChanges({});

      expect(updateCalled).to.equal(false);
    });
  });
});
