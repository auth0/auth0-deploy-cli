import { emailProviderDefaults } from '../../defaults';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedEmailProvider = ParsedAsset<'emailProvider', Asset>;

async function parse(context: YAMLContext): Promise<ParsedEmailProvider> {
  const { emailProvider } = context.assets;

  if (!emailProvider) return { emailProvider: null };

  return {
    emailProvider,
  };
}

async function dump(context: YAMLContext): Promise<ParsedEmailProvider> {
  if (!context.assets.emailProvider) return { emailProvider: null };

  const emailProvider = (() => {
    const { emailProvider } = context.assets;
    const excludedDefaults = context.assets.exclude?.defaults || [];
    if (emailProvider && !excludedDefaults.includes('emailProvider')) {
      // Add placeholder for credentials as they cannot be exported
      return emailProviderDefaults(emailProvider);
    }
    return emailProvider;
  })();

  return {
    emailProvider,
  };
}

const emailProviderHandler: YAMLHandler<ParsedEmailProvider> = {
  parse,
  dump,
};

export default emailProviderHandler;
