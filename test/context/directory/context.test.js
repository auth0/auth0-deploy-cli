import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { cleanThenMkdir, testDataDir } from '../../utils';
import handlers from '../../../src/context/directory/handlers';

describe('#directory context validation', () => {
  it('should do nothing on empty repo', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'empty');
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });
    await context.loadAssetsFromLocal();

    expect(Object.keys(context.assets).length).to.equal(Object.keys(handlers).length + 1);
    Object.keys(context.assets).forEach((key) => {
      if (key === 'exclude') {
        expect(context.assets[key]).to.deep.equal({
          rules: [],
          clients: [],
          databases: [],
          connections: [],
          resourceServers: [],
          defaults: [],
        });
      } else {
        expect(context.assets[key]).to.equal(null);
      }
    });
  });

  it('should load excludes', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'empty');
    cleanThenMkdir(dir);

    const config = {
      AUTH0_INPUT_FILE: dir,
      AUTH0_EXCLUDED_RULES: ['rule'],
      AUTH0_EXCLUDED_CLIENTS: ['client'],
      AUTH0_EXCLUDED_DATABASES: ['db'],
      AUTH0_EXCLUDED_CONNECTIONS: ['conn'],
      AUTH0_EXCLUDED_RESOURCE_SERVERS: ['api'],
      AUTH0_EXCLUDED_DEFAULTS: ['emailProvider'],
    };
    const context = new Context(config);
    await context.loadAssetsFromLocal();

    expect(context.assets.exclude.rules).to.deep.equal(['rule']);
    expect(context.assets.exclude.clients).to.deep.equal(['client']);
    expect(context.assets.exclude.databases).to.deep.equal(['db']);
    expect(context.assets.exclude.connections).to.deep.equal(['conn']);
    expect(context.assets.exclude.resourceServers).to.deep.equal(['api']);
    expect(context.assets.exclude.defaults).to.deep.equal(['emailProvider']);
  });

  it('should respect resource exclusion on import', async () => {
    const tenantConfig = {
      allowed_logout_urls: ['https://mycompany.org/logoutCallback'],
      enabled_locales: ['en'],
    };

    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'resource-exclusion');
    cleanThenMkdir(dir);
    fs.writeFileSync(path.join(dir, 'tenant.json'), JSON.stringify(tenantConfig));

    const contextWithExclusion = new Context({
      AUTH0_INPUT_FILE: dir,
      AUTH0_EXCLUDED: ['tenant'],
    });
    await contextWithExclusion.loadAssetsFromLocal();
    expect(contextWithExclusion.assets.tenant).to.equal(undefined);

    const contextWithoutExclusion = new Context({
      AUTH0_INPUT_FILE: dir,
      AUTH0_EXCLUDED: [], // Not excluding tenant resource
    });
    await contextWithoutExclusion.loadAssetsFromLocal();
    expect(contextWithoutExclusion.assets.tenant).to.deep.equal(tenantConfig);
  });

  it('should respect resource inclusion on import', async () => {
    const tenantConfig = {
      allowed_logout_urls: ['https://mycompany.org/logoutCallback'],
      enabled_locales: ['en'],
    };

    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'resource-inclusion');
    cleanThenMkdir(dir);
    fs.writeFileSync(path.join(dir, 'tenant.json'), JSON.stringify(tenantConfig));

    const contextWithInclusion = new Context({
      AUTH0_INPUT_FILE: dir,
      AUTH0_INCLUDED_ONLY: ['tenant'],
    });
    await contextWithInclusion.loadAssetsFromLocal();
    expect(contextWithInclusion.assets.tenant).to.deep.equal(tenantConfig);
    expect(contextWithInclusion.assets.actions).to.equal(undefined); // Arbitrary sample resources
    expect(contextWithInclusion.assets.clients).to.equal(undefined); // Arbitrary sample resources
  });

  it('should error on bad directory', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'doesNotExist');
    const context = new Context({ AUTH0_INPUT_FILE: dir });
    const errorMessage = `Not sure what to do with, ${dir} as it is not a directory...`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should error on symlink', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'badSymlink');
    const file = path.join(dir, 'badSymLink');
    const link = path.join(dir, 'link');
    try {
      fs.unlinkSync(link);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    cleanThenMkdir(dir);
    fs.symlinkSync(file, link);

    const context = new Context({ AUTH0_INPUT_FILE: link });
    const errorMessage = `Not sure what to do with, ${link} as it is not a directory...`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should preserve keywords when dumping', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'dump');

    const localTenantData = {
      friendly_name: '##ENV## Tenant',
      enabled_locales: '@@LANGUAGES@@',
    };

    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.json');
    fs.writeFileSync(tenantFile, JSON.stringify(localTenantData));

    const context = new Context(
      {
        AUTH0_INPUT_FILE: dir,
        AUTH0_PRESERVE_KEYWORDS: true,
        AUTH0_INCLUDED_ONLY: ['tenant'],
        AUTH0_KEYWORD_REPLACE_MAPPINGS: {
          ENV: 'Production',
          LANGUAGES: ['en', 'es'],
        },
      },
      {
        tenants: {
          getSettings: async () =>
            new Promise((res) =>
              res({
                data: {
                  friendly_name: 'Production Tenant',
                  enabled_locales: ['en', 'es'],
                },
              })
            ),
        },
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
        actions: {
          getSettings: async () => new Promise((res) => res([])),
        },
      }
    );
    await context.dump();
    const json = JSON.parse(fs.readFileSync(tenantFile));

    expect(json).to.deep.equal(localTenantData);
  });
});
