import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedMigrations = ParsedAsset<'migrations', Asset[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedMigrations> {
  const { migrations } = context.assets;

  if (!migrations) return { migrations: null };

  return { migrations };
}

const migrationsHandler: YAMLHandler<ParsedMigrations> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default migrationsHandler;
