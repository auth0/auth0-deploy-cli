import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/hooks';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context hooks', () => {
  it('should process hooks', async () => {
    const dir = path.join(testDataDir, 'yaml', 'hooks1');
    cleanThenMkdir(dir);

    const codeContext = 'function someHook() { var hello = @@hello@@; }';
    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    hooks:
      - name: "Some Hook"
        code: "${codeFile}"
        triggerId: "credentials-exchange"
    `;
    const yamlFile = path.join(dir, 'hook1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        active: false,
        name: 'some-hook',
        dependencies: {},
        secrets: {},
        code: 'function someHook() { var hello = "test"; }',
        triggerId: 'credentials-exchange'
      }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { hello: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.hooks).to.deep.equal(target);
  });

  it('should dump hooks', async () => {
    const dir = path.join(testDataDir, 'yaml', 'hooksDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') }, mockMgmtClient());
    const codeValidation = 'function someHook() { var hello = "test"; }';

    context.assets.hooks = [
      {
        id: '1',
        name: 'someHook',
        code: codeValidation,
        triggerId: 'credentials-exchange'
      },
      {
        id: 'unnamedHook',
        code: codeValidation,
        triggerId: 'credentials-exchange'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      hooks: [
        {
          id: '1',
          name: 'someHook',
          code: './hooks/someHook.js',
          triggerId: 'credentials-exchange'
        },
        {
          id: 'unnamedHook',
          name: 'unnamedHook',
          code: './hooks/unnamedHook.js',
          triggerId: 'credentials-exchange'
        }
      ]
    });

    const hooksFolder = path.join(dir, 'hooks');
    expect(fs.readFileSync(path.join(hooksFolder, 'someHook.js'), 'utf8')).to.deep.equal(codeValidation);
  });

  it('should dump hooks sanitized', async () => {
    const dir = path.join(testDataDir, 'yaml', 'hooksDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') }, mockMgmtClient());
    const codeValidation = 'function someHook() { var hello = "test"; }';

    context.assets.hooks = [
      {
        name: 'someHook / test',
        code: codeValidation,
        triggerId: 'credentials-exchange'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      hooks: [
        {
          name: 'someHook / test',
          code: './hooks/someHook - test.js',
          triggerId: 'credentials-exchange'
        }
      ]
    });

    const hooksFolder = path.join(dir, 'hooks');
    expect(fs.readFileSync(path.join(hooksFolder, 'someHook - test.js'), 'utf8')).to.deep.equal(codeValidation);
  });
});
