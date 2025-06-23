import { YAMLHandler } from '.';
import YAMLContext from '..';
import { sortGuardianFactors } from '../../../tools/utils';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactors = ParsedAsset<'guardianFactors', Asset[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactors> {
  let { guardianFactors } = context.assets;

  if (!guardianFactors) return { guardianFactors: null };

  guardianFactors = sortGuardianFactors(guardianFactors);

  return {
    guardianFactors,
  };
}

const guardianFactorsHandler: YAMLHandler<ParsedGuardianFactors> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianFactorsHandler;
