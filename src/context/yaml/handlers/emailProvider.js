import { emailProviderDefaults } from '../../defaults';

async function parse(context) {
  // nothing to do, set default if empty
  return {
    emailProvider: { ...context.assets.emailProvider || {} }
  };
}

async function dump(context) {
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


export default {
  parse,
  dump
};
