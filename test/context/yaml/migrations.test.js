import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/migrations';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context migrations', () => {
  it('should process migrationss', async () => {
    const dir = path.join(testDataDir, 'yaml', 'migrations');
    cleanThenMkdir(dir);

    const yaml = `
    migrations:
      migration_flag_1: true
      migration_flag_2: false
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      migration_flag_1: true,
      migration_flag_2: false
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.migrations).to.deep.equal(target);
  });

  it('should dump migrations', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const migrations = {
      migration_flags: true
    };
    context.assets.migrations = migrations;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ migrations });
  });

  it('should dump tenant without flags', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const migrations = {
      migration_flags: true
    };
    context.assets.migrations = {
      migration_flags: true
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ migrations });
  });
});
