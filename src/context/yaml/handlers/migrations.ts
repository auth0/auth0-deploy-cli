import { YAMLHandler, Context } from '.'

type ParsedMigrations = {
  migrations: unknown[]
}

async function parse(context: Context): Promise<ParsedMigrations> {
  const { migrations } = context.assets;
  return { migrations };
}

async function dump(context: Context): Promise<ParsedMigrations> {
  const { migrations } = context.assets;

  return { migrations: migrations || {} };
}

const migrationsHandler: YAMLHandler<ParsedMigrations> = {
  parse,
  dump,
};

export default migrationsHandler;
