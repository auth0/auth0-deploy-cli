import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/migrations';
import { loadJSON } from '../../../src/utils';

const migrationsTest = {
  'migrations.json': `{
    "migration_flag": true
  }`
};

const migrationsTarget = {
  migration_flag: true
};

describe('#directory context migrations', () => {
  it('should process migrations', async () => {
    createDir(path.join(testDataDir, 'directory'), { migrations: migrationsTest });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'migrations'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' }
    };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.migrations).to.deep.equal(migrationsTarget);
  });

  it('should dump migrations', async () => {
    const dir = path.join(testDataDir, 'directory', 'migrationsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.migrations = {
      migration_flag: false
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'migrations.json'));

    expect(dumped).to.deep.equal(context.assets.migrations);
  });
});
