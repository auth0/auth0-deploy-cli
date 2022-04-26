import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedMigrations = {
  migrations: Asset | null;
};

async function parse(context: YAMLContext): Promise<ParsedMigrations> {
  const { migrations } = context.assets;

  if (!migrations) return { migrations: null };

  return { migrations };
}

async function dump(context: YAMLContext): Promise<ParsedMigrations> {
  const { migrations } = context.assets;

  return { migrations: migrations || {} };
}

const migrationsHandler: YAMLHandler<ParsedMigrations> = {
  parse,
  dump,
};

export default migrationsHandler;
