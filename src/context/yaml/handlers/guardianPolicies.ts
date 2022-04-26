import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedGuardianPolicies = {
  guardianPolicies: unknown;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianPolicies> {
  const { guardianPolicies } = context.assets;

  if (!guardianPolicies) return { guardianPolicies: null };

  return {
    guardianPolicies,
  };
}

const guardianPoliciesHandler: YAMLHandler<ParsedGuardianPolicies> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPoliciesHandler;
