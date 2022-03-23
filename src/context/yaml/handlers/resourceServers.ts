import { YAMLHandler } from '.'
import YAMLContext from '..'

type ParsedResourceServers = {
  resourceServers: unknown[]
}

async function parse(context: YAMLContext): Promise<ParsedResourceServers> {
  // nothing to do, set default if empty
  return {
    resourceServers: context.assets.resourceServers
  };
}

async function dump(context: YAMLContext): Promise<ParsedResourceServers> {
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