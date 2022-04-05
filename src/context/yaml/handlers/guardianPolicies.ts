import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedGuardianPolicies = {
  guardianPolicies: unknown;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianPolicies> {
  // nothing to do, set default if empty
  return {
    guardianPolicies: { ...(context.assets.guardianPolicies || {}) },
  };
}

const guardianPoliciesHandler: YAMLHandler<ParsedGuardianPolicies> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPoliciesHandler;
