import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianEmailFactorSettings = ParsedAsset<'guardianEmailFactorSettings', Asset>;

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianEmailFactorSettings> {
  const { guardianEmailFactorSettings } = context.assets;

  if (!guardianEmailFactorSettings) return { guardianEmailFactorSettings: null };

  return {
    guardianEmailFactorSettings,
  };
}

const guardianEmailFactorSettingsHandler: YAMLHandler<ParsedGuardianEmailFactorSettings> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianEmailFactorSettingsHandler;
