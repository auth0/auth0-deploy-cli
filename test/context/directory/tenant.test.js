import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/tenant';
import { loadJSON } from '../../../src/utils';

describe('#directory context tenant', () => {
  it('should process tenant', async () => {
    const tenantTest = {
      'tenant.json': `{
        "friendly_name": "Auth0 ##env##",
        "default_directory": "users",
        "session_lifetime": 1.48394893,
        "idle_session_lifetime": 123.4,
        "flags": {}
      }`,
    };

    const tenantTarget = {
      friendly_name: 'Auth0 test',
      default_directory: 'users',
      session_lifetime_in_minutes: 89,
      idle_session_lifetime_in_minutes: 7404,
    };

    createDir(path.join(testDataDir, 'directory'), { tenant1: tenantTest });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'tenant1'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal(tenantTarget);
  });

  it('should process tenant without session durations', async () => {
    const tenantTest = {
      'tenant.json': `{
        "friendly_name": "Auth0 ##env##",
        "default_directory": "users",
        "flags": {}
      }`,
    };

    const tenantTarget = {
      friendly_name: 'Auth0 test',
      default_directory: 'users',
    };

    createDir(path.join(testDataDir, 'directory'), { tenant1: tenantTest });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'tenant1'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal(tenantTarget);
  });

  it('should dump tenant', async () => {
    const dir = path.join(testDataDir, 'directory', 'tenantDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.tenant = {
      friendly_name: 'Auth0 test',
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'tenant.json'));

    expect(dumped).to.deep.equal(context.assets.tenant);
  });

  it('should dump tenant without flags', async () => {
    const dir = path.join(testDataDir, 'directory', 'tenantDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const tenant = {
      friendly_name: 'Test',
    };
    context.assets.tenant = {
      friendly_name: 'Test',
      flags: {},
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'tenant.json'));

    expect(dumped).to.deep.equal(tenant);
  });
});
