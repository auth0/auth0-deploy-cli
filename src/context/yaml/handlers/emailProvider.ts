import { emailProviderDefaults } from '../../defaults';
import { YAMLHandler, Context } from '.'

type ParsedEmailProvider = {
  emailProvider: unknown
}

async function parse(context: Context): Promise<ParsedEmailProvider> {
  // nothing to do, set default if empty
  return {
    emailProvider: { ...context.assets.emailProvider || {} }
  };
}

async function dump(context: Context): Promise<ParsedEmailProvider> {
  let { emailProvider } = context.assets;

  const excludedDefaults = context.assets.exclude.defaults || [];
  if (emailProvider && !excludedDefaults.includes('emailProvider')) {
    // Add placeholder for credentials as they cannot be exported
    emailProvider = emailProviderDefaults(emailProvider);
  }

  return {
    emailProvider: emailProvider || {}
  };
}

const emailProviderHandler: YAMLHandler<ParsedEmailProvider> = {
  parse,
  dump,
};

export default emailProviderHandler;