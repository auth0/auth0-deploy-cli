import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedMigrations = ParsedAsset<'migrations', Asset[]>;

function parse(context: DirectoryContext): ParsedMigrations {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return { migrations: null }; // Skip

  const migrationsFile = path.join(baseFolder, 'migrations.json');

  if (!isFile(migrationsFile)) return { migrations: null };

  /* eslint-disable camelcase */
  const migrations = loadJSON(migrationsFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

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
