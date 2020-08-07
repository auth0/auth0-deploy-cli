import { emailProviderDefaults } from '../../defaults';


async function dump(context) {
  let { emailProvider } = context.assets;

  if (!emailProvider || !emailProvider.name) return null; // Skip, nothing to dump

  const excludedDefaults = context.assets.exclude.defaults || [];
  if (!excludedDefaults.includes('emailProvider')) {
    // Add placeholder for credentials as they cannot be exported
    emailProvider = emailProviderDefaults(emailProvider);
  }
  return {
    type: 'auth0_email',
    name: emailProvider.name,
    content: emailProvider
  };
}


export default {
  dump
};
