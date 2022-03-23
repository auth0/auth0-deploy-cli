import { YAMLHandler, Context } from '.'

type ParsedResourceServers = {
  resourceServers: unknown[]
}

async function parse(context: Context): Promise<ParsedResourceServers> {
  // nothing to do, set default if empty
  return {
    resourceServers: context.assets.resourceServers
  };
}

async function dump(context: Context): Promise<ParsedResourceServers> {
  // nothing to do, set default if empty
  return {
    resourceServers: [...context.assets.resourceServers || []]
  };
}

const resourceServersHandler: YAMLHandler<ParsedResourceServers> = {
  parse,
  dump,
};

export default resourceServersHandler;