import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianSettings = ParsedAsset<'guardianSettings', Asset>;

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianSettings> {
  const { guardianSettings } = context.assets;

  if (!guardianSettings) return { guardianSettings: null };

  return {
    guardianSettings,
  };
}

const guardianSettingsHandler: YAMLHandler<ParsedGuardianSettings> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianSettingsHandler;
