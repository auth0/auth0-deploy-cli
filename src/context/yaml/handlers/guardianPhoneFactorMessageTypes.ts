import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedGuardianFactorMessageTypes = {
  guardianPhoneFactorMessageTypes: unknown;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactorMessageTypes> {
  const { guardianPhoneFactorMessageTypes } = context.assets;

  if (!guardianPhoneFactorMessageTypes) return { guardianPhoneFactorMessageTypes: null };

  return {
    guardianPhoneFactorMessageTypes,
  };
}

const guardianPhoneFactorMessageTypesHandler: YAMLHandler<ParsedGuardianFactorMessageTypes> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPhoneFactorMessageTypesHandler;
