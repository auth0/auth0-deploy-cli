import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianPolicies';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian policies provider', () => {
  it('should process guardianPolicies', async () => {
    const guardianPoliciesTest = {
      'policies.json': `{
        "policies": [
          "all-applications"
        ]
      }`
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianPolicies');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianPoliciesTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.guardianPolicies).to.deep.equal({
      policies: [ 'all-applications' ]
    });
  });

  it('should dump guardian policies', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianPoliciesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianPolicies = {
      policies: [ 'all-applications' ]
    };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'policies.json'))).to.deep.equal({
      policies: [ 'all-applications' ]
    });
  });
});
