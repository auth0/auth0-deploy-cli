import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedMigrations = {
  migrations: Asset | null;
};

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
