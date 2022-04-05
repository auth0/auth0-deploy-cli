import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

type ParsedMigrations =
  | {
      migrations: unknown[];
    }
  | {};

function parse(context: DirectoryContext): ParsedMigrations {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return {}; // Skip

  const migrationsFile = path.join(baseFolder, 'migrations.json');

  if (!isFile(migrationsFile)) return {};

  /* eslint-disable camelcase */
  const migrations = loadJSON(migrationsFile, context.mappings);

  return { migrations };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { migrations } = context.assets;

  if (!migrations || Object.keys(migrations).length === 0) return; // Skip, nothing to dump

  const migrationsFile = path.join(context.filePath, 'migrations.json');
  dumpJSON(migrationsFile, migrations);
}

const migrationsHandler: DirectoryHandler<ParsedMigrations> = {
  parse,
  dump,
};

export default migrationsHandler;
