import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactorTemplates = ParsedAsset<'guardianFactorTemplates', Asset[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactorTemplates> {
  const { guardianFactorTemplates } = context.assets;

  if (!guardianFactorTemplates) return { guardianFactorTemplates: null };

  return {
    guardianFactorTemplates,
  };
}

const guardianFactorTemplatesHandler: YAMLHandler<ParsedGuardianFactorTemplates> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianFactorTemplatesHandler;
