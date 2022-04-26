import { emailProviderDefaults } from '../../defaults';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedEmailProvider = {
  emailProvider: Asset | null;
};

async function parse(context: YAMLContext): Promise<ParsedEmailProvider> {
  const { emailProvider } = context.assets;

  if (!emailProvider) return { emailProvider: null };

  return {
    emailProvider,
  };
}

async function dump(context: YAMLContext): Promise<ParsedEmailProvider> {
  let { emailProvider } = context.assets;

  const excludedDefaults = context.assets.exclude?.defaults || [];
  if (emailProvider && !excludedDefaults.includes('emailProvider')) {
    // Add placeholder for credentials as they cannot be exported
    emailProvider = emailProviderDefaults(emailProvider);
  }

  return {
    emailProvider: emailProvider || {},
  };
}

const emailProviderHandler: YAMLHandler<ParsedEmailProvider> = {
  parse,
  dump,
};

export default emailProviderHandler;
