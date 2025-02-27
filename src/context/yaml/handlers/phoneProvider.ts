import { YAMLHandler } from '.';
import YAMLContext from '..';
import { PhoneProvider } from '../../../tools/auth0/handlers/phoneProvider';
import { ParsedAsset } from '../../../types';

type ParsedPhoneProviders = ParsedAsset<'phoneProviders', PhoneProvider[] >;

async function parse(context: YAMLContext): Promise<ParsedPhoneProviders> {
  const { phoneProviders } = context.assets;

  if (!phoneProviders) return { phoneProviders: null };

  console.log(phoneProviders);

  return {
    phoneProviders,
  };
}

async function dump(context: YAMLContext): Promise<ParsedPhoneProviders> {
  if (!context.assets.phoneProviders) return { phoneProviders: null };

  const { phoneProviders } = context.assets;

  return {
    // @ts-ignore
    phoneProviders: phoneProviders.map(({ created_at, updated_at, tenant, channel, credentials, ...rest }) => rest)
  };
}

const phoneProviderHandler: YAMLHandler<ParsedPhoneProviders> = {
  parse,
  dump,
};

export default phoneProviderHandler;
