import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/directory';
import { cleanThenMkdir, writeStringToFile, testDataDir } from 'test/utils';

function createRulesDir(dir, target) {
  cleanThenMkdir(dir);
  Object.keys(target).forEach((scriptName) => {
    writeStringToFile(
      path.resolve(dir, scriptName + '.js'),
      target[scriptName].scriptFile
    );
    if (target[scriptName].metadata) {
      writeStringToFile(
        path.resolve(dir, scriptName + '.json'),
        target[scriptName].metadataFile
      );
    }
  });
}

describe('#context directory rules', () => {
  it('should process rules', async () => {
    const target = {
      someRule: {
        script: true,
        scriptFile: 'function someRule() { var hello = @@hello@@; }',
        name: 'someRule'
      },
      someRuleWithMeta: {
        script: true,
        scriptFile: 'function someRuleWithMeta() { }',
        metadata: true,
        metadataFile: '{ "enabled": "foo" }',
        name: 'someRuleWithMeta'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'rules1');
    const dir = path.join(repoDir, constants.RULES_DIRECTORY);
    createRulesDir(dir, target);

    const context = new Context(repoDir, { hello: 'goodbye' });
    await context.init();
    target.someRule.scriptFile = 'function someRule() { var hello = "goodbye"; }';
    expect(context.rules).to.deep.equal(target);
  });

  it('should ignore bad rules file', async () => {
    const target = {
      someRule: {
        script: true,
        scriptFile: 'function someRule() { }',
        name: 'someRule'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'rules2');
    const dir = path.join(repoDir, constants.RULES_DIRECTORY);
    createRulesDir(dir, target);

    const file = path.join(dir, 'README.md');
    writeStringToFile(file, 'something');

    const context = new Context(repoDir);
    await context.init();
    expect(context.rules).to.deep.equal(target);
  });

  it('should ignore bad rules directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rules3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.RULES_DIRECTORY);
    writeStringToFile(dir, 'junk');

    const context = new Context(repoDir);
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
