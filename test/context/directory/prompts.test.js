import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import {
  testDataDir, createDir, mockMgmtClient, cleanThenMkdir
} from '../../utils';
import handler from '../../../src/context/directory/handlers/prompts';
import { loadJSON } from '../../../src/utils';

const promptsTest = {
  'prompts.json': `{
    "universal_login_experience": "##universal_login_experience##",
    "identifier_first": true,
    "webauthn_platform_first_factor": false
  }`
};

const promptsTarget = {
  universal_login_experience: 'new',
  identifier_first: true,
  webauthn_platform_first_factor: false
};

describe('#directory context prompts', () => {
  it('should process prompts', async () => {
    createDir(path.join(testDataDir, 'directory'), { prompts1: promptsTest });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'prompts1'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { universal_login_experience: 'new' }
    };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.prompts).to.deep.equal(promptsTarget);
  });

  it('should dump prompts', async () => {
    const dir = path.join(testDataDir, 'directory', 'promptsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.prompts = {
      universal_login_experience: 'new',
      identifier_first: true,
      webauthn_platform_first_factor: false
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'prompts.json'));

    expect(dumped).to.deep.equal(context.assets.prompts);
  });
});
