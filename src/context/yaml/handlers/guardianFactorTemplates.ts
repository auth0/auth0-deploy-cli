import { YAMLHandler } from '.'
import YAMLContext from '..'

type ParsedGuardianFactorTemplates = {
  guardianFactorTemplates: unknown[]
}

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactorTemplates> {
  // nothing to do, set default if empty
  return {
    guardianFactorTemplates: [ ...context.assets.guardianFactorTemplates || [] ]
  };
}

const guardianFactorTemplatesHandler: YAMLHandler<ParsedGuardianFactorTemplates> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianFactorTemplatesHandler;