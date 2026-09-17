import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianPhoneFactorSettings = ParsedAsset<'guardianPhoneFactorSettings', Asset>;

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianPhoneFactorSettings> {
  const { guardianPhoneFactorSettings } = context.assets;

  if (!guardianPhoneFactorSettings) return { guardianPhoneFactorSettings: null };

  return {
    guardianPhoneFactorSettings,
  };
}

const guardianPhoneFactorSettingsHandler: YAMLHandler<ParsedGuardianPhoneFactorSettings> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianPhoneFactorSettingsHandler;
