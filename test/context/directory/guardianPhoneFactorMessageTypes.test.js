import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianPhoneFactorMessageTypes';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian phone factor message types provider', () => {
  it('should process guardianPhoneFactorMessageTypes', async () => {
    const guardianPhoneFactorMessageTypesTest = {
      'phoneFactorMessageTypes.json': `{
        "message_types": [ "sms", "voice" ]
      }`
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianPhoneFactorMessageTypes');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianPhoneFactorMessageTypesTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.guardianPhoneFactorMessageTypes).to.deep.equal({
      message_types: [ 'sms', 'voice' ]
    });
  });

  it('should dump guardian phone factor message types', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianPhoneFactorMessageTypesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianPhoneFactorMessageTypes = {
      message_types: [ 'sms', 'voice' ]
    };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'phoneFactorMessageTypes.json'))).to.deep.equal({
      message_types: [ 'sms', 'voice' ]
    });
  });
});
