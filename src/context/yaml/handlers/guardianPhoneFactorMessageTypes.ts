import { YAMLHandler } from '.'
import YAMLContext from '..'

type ParsedGuardianFactorMessageTypes = {
  guardianPhoneFactorMessageTypes: unknown
}

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactorMessageTypes> {
  // nothing to do, set default if empty
  return {
    guardianPhoneFactorMessageTypes: { ...context.assets.guardianPhoneFactorMessageTypes || {} }
  };
}

const guardianPhoneFactorMessageTypesHandler: YAMLHandler<ParsedGuardianFactorMessageTypes> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPhoneFactorMessageTypesHandler;
