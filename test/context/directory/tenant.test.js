import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/tenant';
import { loadJSON } from '../../../src/utils';

const tenantTest = {
  'tenant.json': `{
    "friendly_name": "Auth0 ##env##",
    "default_directory": "users",
    "idle_session_lifetime": 72
  }`
};

const tenantTarget = {
  friendly_name: 'Auth0 test',
  default_directory: 'users',
  idle_session_lifetime: 72
};

describe('#directory context tenant', () => {
  it('should process tenant', async () => {
    createDir(path.join(testDataDir, 'directory'), { tenant1: tenantTest });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'tenant1'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' }
    };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.tenant).to.deep.equal(tenantTarget);
  });

  it('should dump tenant', async () => {
    const dir = path.join(testDataDir, 'directory', 'tenantDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.tenant = {
      friendly_name: 'Auth0 test'
    };

    await handler.dump(context);
    expect(loadJSON(path.join(dir, 'tenant.json'))).to.deep.equal(context.assets.tenant);
  });
});
