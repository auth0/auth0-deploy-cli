import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianPolicies = ParsedAsset<'guardianPolicies', { policies: Asset[] }>;

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
