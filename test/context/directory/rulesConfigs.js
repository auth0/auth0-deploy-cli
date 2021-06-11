import fs from 'fs-extra';

import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/rulesConfigs';
import {
  cleanThenMkdir, testDataDir, createDir, mockMgmtClient
} from '../../utils';

describe('#directory context rulesConfigs', () => {
  it('should process rules configs', async () => {
    const files = {
      [constants.RULES_CONFIGS_DIRECTORY]: {
        'setting1.json': '{ "key": "setting1", "value": "##env##" }',
        'setting2.json': '{ "key": "setting2", "value": "##env##" }'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'rulesconfigs1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      { key: 'setting1', value: 'test' },
      { key: 'setting2', value: 'test' }
    ];
    expect(context.assets.rulesConfigs).to.deep.equal(target);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.RULES_CONFIGS_DIRECTORY]: {
        'setting1.json': '{ "key": "setting1", "value": "##env##" }',
        'README.md': 'something'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'rulesconfigs2');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      { key: 'setting1', value: 'test' }
    ];

    expect(context.assets.rulesConfigs).to.deep.equal(target);
  });

  it('should ignore bad rulesConfig directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rulesconfigs3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.RULES_CONFIGS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should not dump rules configs', async () => {
    const dir = path.join(testDataDir, 'directory', 'rulesConfigsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.rulesConfigs = [
      { key: 'SOME_SECRET', value: 'some_key' }
    ];

    await handler.dump(context);
    const rulesConfigsFolder = path.join(dir, constants.RULES_CONFIGS_DIRECTORY);
    const exists = await fs.pathExists(path.join(rulesConfigsFolder, 'SOME_SECRET.json'));
    expect(exists).to.equal(false);
  });
});
