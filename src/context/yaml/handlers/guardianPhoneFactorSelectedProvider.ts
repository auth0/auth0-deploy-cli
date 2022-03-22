import { YAMLHandler, Context } from '.'

type ParsedGuardianPhoneFactorSelectedProvider = {
  guardianPhoneFactorSelectedProvider: unknown
}

async function parseAndDump(context: Context): Promise<ParsedGuardianPhoneFactorSelectedProvider> {
  // nothing to do, set default empty
  return {
    guardianPhoneFactorSelectedProvider: { ...context.assets.guardianPhoneFactorSelectedProvider || {} }
  };
}

const guardianPhoneFactorSelectedProviderHandler: YAMLHandler<ParsedGuardianPhoneFactorSelectedProvider> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPhoneFactorSelectedProviderHandler;