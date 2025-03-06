import { YAMLHandler } from '.';
import YAMLContext from '..';
import { PhoneProvider } from '../../../tools/auth0/handlers/phoneProvider';
import { ParsedAsset } from '../../../types';

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

  const { phoneProviders } = context.assets;

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'channel', 'tenant', 'credentials'];
  phoneProviders.forEach((provider) => {
    removeKeysFromOutput.forEach((key) => {
      if (key in provider) {
        delete provider[key];
      }
    });
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
