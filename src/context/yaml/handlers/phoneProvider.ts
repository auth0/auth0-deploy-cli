import { phoneProviderDefaults } from '../../defaults';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedPhoneProviders = ParsedAsset<'phoneProviders', Asset>;

async function parse(context: YAMLContext): Promise<ParsedPhoneProviders> {
  const { phoneProviders } = context.assets;

  if (!phoneProviders) return { phoneProviders: null };

  return {
    phoneProviders,
  };
}

async function dump(context: YAMLContext): Promise<ParsedPhoneProviders> {
  if (!context.assets.phoneProviders) return { phoneProviders: null };

  const phoneProviders = (() => {
    const { phoneProviders } = context.assets;
    const excludedDefaults = context.assets.exclude?.defaults || [];
    if (phoneProviders && !excludedDefaults.includes('phoneProviders')) {
      // Add placeholder for credentials as they cannot be exported
      return phoneProviderDefaults(phoneProviders);
    }
    return phoneProviders;
  })();

  return {
    phoneProviders,
  };
}

const phoneProviderHandler: YAMLHandler<ParsedPhoneProviders> = {
  parse,
  dump,
};

export default phoneProviderHandler;
