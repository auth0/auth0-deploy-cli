import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianPhoneFactorSelectedProvider = ParsedAsset<
  'guardianPhoneFactorSelectedProvider',
  Asset
>;

async function parseAndDump(
  context: YAMLContext
): Promise<ParsedGuardianPhoneFactorSelectedProvider> {
  const { guardianPhoneFactorSelectedProvider } = context.assets;

  if (!guardianPhoneFactorSelectedProvider) return { guardianPhoneFactorSelectedProvider: null };

  return {
    guardianPhoneFactorSelectedProvider,
  };
}

const guardianPhoneFactorSelectedProviderHandler: YAMLHandler<ParsedGuardianPhoneFactorSelectedProvider> =
  {
    parse: parseAndDump,
    dump: parseAndDump,
  };

export default guardianPhoneFactorSelectedProviderHandler;
