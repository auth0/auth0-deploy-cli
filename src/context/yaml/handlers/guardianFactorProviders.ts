import { YAMLHandler, Context } from '.'

type ParsedGuardianFactorProviders = {
  guardianFactorProviders: unknown[]
}

async function parseAndDump(context: Context): Promise<ParsedGuardianFactorProviders> {
  // nothing to do, set default empty
  return {
    guardianFactorProviders: [...context.assets.guardianFactorProviders || []]
  };
}

const guardianFactorProvidersHandler: YAMLHandler<ParsedGuardianFactorProviders> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianFactorProvidersHandler;