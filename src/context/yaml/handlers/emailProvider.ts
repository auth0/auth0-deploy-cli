import { emailProviderDefaults } from '../../defaults';
import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedEmailProvider = {
  emailProvider: unknown;
};

async function parse(context: YAMLContext): Promise<ParsedEmailProvider> {
  // nothing to do, set default if empty
  return {
    emailProvider: { ...(context.assets.emailProvider || {}) },
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
