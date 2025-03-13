import { YAMLHandler } from '.';
import YAMLContext from '..';
import { PhoneProvider } from '../../../tools/auth0/handlers/phoneProvider';
import { ParsedAsset } from '../../../types';
import { phoneProviderDefaults } from '../../defaults';

type ParsedPhoneProviders = ParsedAsset<'phoneProviders', PhoneProvider[] >;

async function parse(context: YAMLContext): Promise<ParsedPhoneProviders> {
  const { phoneProviders } = context.assets;

  if (!phoneProviders) return { phoneProviders: null };

  return {
    phoneProviders,
  };
}

async function dump(context: YAMLContext): Promise<ParsedPhoneProviders> {
  if (!context.assets.phoneProviders) return { phoneProviders: null };

  let { phoneProviders } = context.assets;

  phoneProviders = phoneProviders.map((provider) => {
    provider = phoneProviderDefaults(provider);
    return provider;
  });

  return {
    phoneProviders
  };
}

const phoneProviderHandler: YAMLHandler<ParsedPhoneProviders> = {
  parse,
  dump,
};

export default phoneProviderHandler;
