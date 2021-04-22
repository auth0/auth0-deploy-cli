import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/triggers';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';


const actionFiles = {
  [constants.TRIGGERS_DIRECTORY]: {
    'triggers.json': `{
      "post-login": [
        {
          "action_name": "test-action",
          "display_name": "display-name"
        }
      ],
      "credentials-exchange": [],
      "pre-user-registration": [],
      "post-user-registration": [],
      "post-change-password": [],
      "send-phone-message": []
    }`
  }
};

const triggersTarget = {
  'post-login': [
    {
      action_name: 'test-action',
      display_name: 'display-name'
    }
  ],
  'credentials-exchange': [],
  'pre-user-registration': [],
  'post-user-registration': [],
  'post-change-password': [],
  'send-phone-message': []
};


describe('#directory context triggers', () => {
  it('should process triggers', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test1');
    createDir(repoDir, actionFiles);
    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.triggers).to.deep.equal(triggersTarget);
  });

  it('should ignore bad triggers directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test2');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.TRIGGERS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir });
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump triggers', async () => {
    const dir = path.join(testDataDir, 'directory', 'test3');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.triggers = triggersTarget;

    await handler.dump(context);

    const triggersFolder = path.join(dir, constants.TRIGGERS_DIRECTORY);

    expect(loadJSON(path.join(triggersFolder, 'triggers.json'))).to.deep.equal({
      'post-login': [
        {
          action_name: 'test-action',
          display_name: 'display-name'
        }
      ],
      'credentials-exchange': [],
      'pre-user-registration': [],
      'post-user-registration': [],
      'post-change-password': [],
      'send-phone-message': []
    });
  });
});
