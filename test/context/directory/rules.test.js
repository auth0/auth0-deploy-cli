import fs from 'fs-extra';
import { constants } from '../../../src/tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/rules';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const rules = {
  'somerule.js': 'function someRule() { var hello = @@hello@@; }',
  'somerule.json': '{ "name": "somerule", "enabled": "foo", "script": "somerule.js" }',
  'otherrule.js': 'function someRule() { var hello = @@hello@@; }',
  'otherrule.json': '{ "name": "otherrule", "enabled": "foo", "script": "otherrule.js" }'
};

const rulesTarget = [
  { enabled: 'foo', name: 'otherrule', script: 'function someRule() { var hello = "goodbye"; }' },
  { enabled: 'foo', name: 'somerule', script: 'function someRule() { var hello = "goodbye"; }' }
];


describe('#directory context rules', () => {
  it('should process rules', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rules1');
    const dir = path.join(repoDir);
    createDir(dir, { [constants.RULES_DIRECTORY]: rules });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { hello: 'goodbye' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal(rulesTarget);
  });

  it('should ignore unknown file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rules2');
    const dir = path.join(repoDir);
    createDir(dir, { [constants.RULES_DIRECTORY]: rules });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { hello: 'goodbye' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal(rulesTarget);
  });

  it('should ignore bad rules directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rules3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.RULES_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir });
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump rules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const scriptValidation = 'function someRule() { var hello = "test"; }';

    context.assets.rules = [
      {
        enabled: false,
        name: 'someRule',
        order: 10,
        script: scriptValidation,
        stage: 'login_success'
      }
    ];

    await handler.dump(context);

    const rulesFolder = path.join(dir, constants.RULES_DIRECTORY);

    expect(loadJSON(path.join(rulesFolder, 'someRule.json'))).to.deep.equal({
      enabled: false,
      name: 'someRule',
      order: 10,
      script: './someRule.js',
      stage: 'login_success'
    });
    expect(fs.readFileSync(path.join(rulesFolder, 'someRule.js'), 'utf8')).to.deep.equal(scriptValidation);
  });

  it('should dump rules sanitized', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const scriptValidation = 'function someRule() { var hello = "test"; }';

    context.assets.rules = [
      {
        enabled: false,
        name: 'some/Rule',
        order: 10,
        script: scriptValidation,
        stage: 'login_success'
      }
    ];

    await handler.dump(context);

    const rulesFolder = path.join(dir, constants.RULES_DIRECTORY);

    expect(loadJSON(path.join(rulesFolder, 'some-Rule.json'))).to.deep.equal({
      enabled: false,
      name: 'some/Rule',
      order: 10,
      script: './some-Rule.js',
      stage: 'login_success'
    });
    expect(fs.readFileSync(path.join(rulesFolder, 'some-Rule.js'), 'utf8')).to.deep.equal(scriptValidation);
  });
});
