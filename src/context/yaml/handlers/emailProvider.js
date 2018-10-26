import { emailProviderDefaults } from '../../defaults';

async function parse(context) {
  // nothing to do, set default if empty
  return {
    emailProvider: { ...context.assets.emailProvider || {} }
  };
}

async function dump(context) {
  let { emailProvider } = context.assets;

  // Add placeholder for credentials as they cannot be exported
  if (emailProvider) {
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
