import { constants } from '../../../src/tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianFactors';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian factors provider', () => {
  it('should process guardianFactors', async () => {
    const guardianFactorsTest = {
      'sms.json': `{
        "name": "sms",
        "enabled": true
      }`,
      'otp.json': `{
        "name": "otp",
        "enabled": true
      }`

    };

    const folder = path.join(constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_FACTORS_DIRECTORY);
    const repoDir = path.join(testDataDir, 'directory', 'guardianFactors');
    createDir(repoDir, { [folder]: guardianFactorsTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.guardianFactors).to.deep.equal([
      { enabled: true, name: 'otp' },
      { enabled: true, name: 'sms' }
    ]);
  });

  it('should dump guardian factors', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianFactorsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianFactors = [
      { enabled: true, name: 'otp' },
      { enabled: true, name: 'sms' }
    ];

    await handler.dump(context);
    const factorsFolder = path.join(dir, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_FACTORS_DIRECTORY);
    expect(loadJSON(path.join(factorsFolder, 'sms.json'))).to.deep.equal({ enabled: true, name: 'sms' });
    expect(loadJSON(path.join(factorsFolder, 'otp.json'))).to.deep.equal({ enabled: true, name: 'otp' });
  });
});
