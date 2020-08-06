import { emailProviderDefaults } from '../../defaults';

function parse(context) {
  throw new Error('Not Implemented ' + context);
}

async function dump(context) {
  let { emailProvider } = context.assets;

  if (!emailProvider) return; // Skip, nothing to dump

  const excludedDefaults = context.assets.exclude.defaults || [];
  if (!excludedDefaults.includes('emailProvider')) {
    // Add placeholder for credentials as they cannot be exported
    emailProvider = emailProviderDefaults(emailProvider);
  }
  return ({
    type: 'auth0_email',
    name: emailProvider.name,
    content: emailProvider
  });
}


export default {
  parse,
  dump
};
