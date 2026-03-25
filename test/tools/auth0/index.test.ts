import { expect } from 'chai';
import * as sinon from 'sinon';
import Auth0 from '../../../src/tools/auth0';
import * as calculateDryRunChanges from '../../../src/tools/calculateDryRunChanges';
import * as utils from '../../../src/tools/utils';
import { Auth0APIClient, Assets } from '../../../src/types';

const mockEmptyClient = {
  prompts: {
    _getRestClient: (endpoint) => ({
      get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
    }),
  },
} as Auth0APIClient;

const mockEmptyAssets = {} as Assets;

describe('#Auth0 class', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.AUTH0_DEBUG;
  });

  describe('#resource exclusion', () => {
    it('should exclude handlers listed in AUTH0_EXCLUDED from Auth0 class', () => {
      const auth0WithoutExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_EXCLUDED: [] };
        return config[key];
      });

      const AUTH0_EXCLUDED = ['organizations', 'connections'];
      const auth0WithExclusions = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = { AUTH0_EXCLUDED };
        return config[key];
      });

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
      const AUTH0_INCLUDED_ONLY = ['organizations', 'connections'];
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

  describe('#dry run preview', () => {
    it('should render a boxed table with closed top and bottom borders', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      const printedMessages: string[] = [];
      sandbox.stub(utils, 'printCLIMessage').callsFake((message: string) => {
        printedMessages.push(message);
      });

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_ALLOW_DELETE: true,
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
          AUTH0_INPUT_FILE: './tenant.yaml',
        };

        return config[key];
      });

      auth0.handlers = [
        {
          type: 'resourceServers',
          dryRunChanges: async () => ({
            create: [],
            update: [{ name: 'Role test API' }],
            del: [],
          }),
          getResourceName: (item: { name: string }) => item.name,
        },
      ] as any;

      const hasChanges = await auth0.dryRun();
      const output = printedMessages[printedMessages.length - 1].replace(
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
        ''
      );

      expect(hasChanges).to.equal(true);
      expect(output).to.include('┌');
      expect(output).to.include('└');
      expect(output).to.match(/┌[─┬]+┐/);
      expect(output).to.match(/│ Resource\s+│ Status\s+│ Name \/ Identifier\s+│/);
      expect(output).to.match(/│ ResourceServers\s+│ UPDATE\s+│ Role test API\s+│/);
      expect(output).to.match(/└[─┴]+┘/);
    });

    it('should output "No changes detected" when all handlers report no changes', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      const printedMessages: string[] = [];
      sandbox.stub(utils, 'printCLIMessage').callsFake((message: string) => {
        printedMessages.push(message);
      });

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
          AUTH0_INPUT_FILE: './tenant.yaml',
        };
        return config[key];
      });

      auth0.handlers = [
        {
          type: 'clients',
          dryRunChanges: async () => ({ create: [], update: [], del: [] }),
          getResourceName: (item: { name: string }) => item.name,
        },
      ] as any;

      const hasChanges = await auth0.dryRun();
      const output = printedMessages[printedMessages.length - 1].replace(
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
        ''
      );

      expect(hasChanges).to.equal(false);
      expect(output).to.include('No changes detected');
    });

    it('should show DELETE with asterisk note when AUTH0_ALLOW_DELETE is false', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      const printedMessages: string[] = [];
      sandbox.stub(utils, 'printCLIMessage').callsFake((message: string) => {
        printedMessages.push(message);
      });

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_ALLOW_DELETE: false,
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
          AUTH0_INPUT_FILE: './tenant.yaml',
        };
        return config[key];
      });

      auth0.handlers = [
        {
          type: 'clients',
          dryRunChanges: async () => ({
            create: [],
            update: [],
            del: [{ name: 'Old App' }],
          }),
          getResourceName: (item: { name: string }) => item.name,
        },
      ] as any;

      const hasChanges = await auth0.dryRun();
      const output = printedMessages[printedMessages.length - 1].replace(
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
        ''
      );

      expect(hasChanges).to.equal(true);
      expect(output).to.include('Requires AUTH0_ALLOW_DELETE to be enabled');
      expect(output).to.include('DELETE');
    });

    it('should show CREATE changes in the table', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      const printedMessages: string[] = [];
      sandbox.stub(utils, 'printCLIMessage').callsFake((message: string) => {
        printedMessages.push(message);
      });

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
          AUTH0_INPUT_FILE: './tenant.yaml',
        };
        return config[key];
      });

      auth0.handlers = [
        {
          type: 'actions',
          dryRunChanges: async () => ({
            create: [{ name: 'New Action' }],
            update: [],
            del: [],
          }),
          getResourceName: (item: { name: string }) => item.name,
        },
      ] as any;

      const hasChanges = await auth0.dryRun();
      const output = printedMessages[printedMessages.length - 1].replace(
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
        ''
      );

      expect(hasChanges).to.equal(true);
      expect(output).to.include('CREATE');
      expect(output).to.include('New Action');
    });

    it('should propagate handler errors with type and stage annotations', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      sandbox.stub(utils, 'printCLIMessage');

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
        };
        return config[key];
      });

      auth0.handlers = [
        {
          type: 'clients',
          dryRunChanges: async () => {
            throw new Error('API failure');
          },
          getResourceName: (item: { name: string }) => item.name,
        },
      ] as any;

      try {
        await auth0.dryRun();
        expect.fail('Expected dryRun to throw');
      } catch (err) {
        expect(err.message).to.equal('API failure');
        expect(err.type).to.equal('clients');
        expect(err.stage).to.equal('dryRun');
      }
    });

    it('should use default input path when AUTH0_INPUT_FILE is not set', async () => {
      process.env.AUTH0_DEBUG = 'true';

      sandbox
        .stub(calculateDryRunChanges, 'dryRunFormatAssets')
        .callsFake(async (assets) => assets);

      const printedMessages: string[] = [];
      sandbox.stub(utils, 'printCLIMessage').callsFake((message: string) => {
        printedMessages.push(message);
      });

      const auth0 = new Auth0(mockEmptyClient, mockEmptyAssets, (key) => {
        const config = {
          AUTH0_DOMAIN: 'example-tenant.auth0.com',
        };
        return config[key];
      });

      auth0.handlers = [] as any;

      await auth0.dryRun();
      const output = printedMessages[printedMessages.length - 1].replace(
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
        ''
      );

      expect(output).to.include('./tenant-config-directory/');
    });
  });
});
