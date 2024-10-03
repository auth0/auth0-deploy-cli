import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedGuardianPolicies = ParsedAsset<'guardianPolicies', { policies: string[] }>;

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
