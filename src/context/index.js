import path from 'path';
import { AuthenticationClient, ManagementClient } from 'auth0';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';

export default async function(config) {
  // Validate config
  const errors = [];

  if (!config.WEBTASK_API_TOKEN) errors.push('WEBTASK_API_TOKEN');
  if (!config.WEBTASK_API_URL) errors.push('WEBTASK_API_URL');

  process.env.WEBTASK_API_TOKEN = config.WEBTASK_API_TOKEN;
  process.env.WEBTASK_API_URL = config.WEBTASK_API_URL;

  if (!config.AUTH0_DOMAIN) errors.push('AUTH0_DOMAIN');
  if (!config.AUTH0_ACCESS_TOKEN) {
    if (!config.AUTH0_CLIENT_ID) errors.push('AUTH0_CLIENT_ID');
    if (!config.AUTH0_CLIENT_SECRET) errors.push('AUTH0_CLIENT_SECRET');
  }

  if (errors.length > 0) {
    throw new Error(
      `The following parameters were missing. Please add them to your config.json or as an environment variable. ${JSON.stringify(
        errors
      )}`
    );
  }

  let accessToken = config.AUTH0_ACCESS_TOKEN;

  if (!accessToken) {
    const authClient = new AuthenticationClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_CLIENT_ID,
      clientSecret: config.AUTH0_CLIENT_SECRET
    });

    const clientCredentials = await authClient.clientCredentialsGrant({
      audience: `https://${config.AUTH0_DOMAIN}/api/v2/`
    });
    accessToken = clientCredentials.access_token;
  }

  const mgmtClient = new ManagementClient({
    domain: config.AUTH0_DOMAIN,
    token: accessToken
  });

  const inputFile = config.AUTH0_INPUT_FILE;

  if (typeof inputFile === 'object') {
    return new YAMLContext(config, mgmtClient);
  }

  if (isDirectory(inputFile)) {
    return new DirectoryContext(config, mgmtClient);
  }

  const ext = path.extname(inputFile);
  if (ext === '.yaml' || ext === '.yml') {
    return new YAMLContext(config, mgmtClient);
  }

  throw new Error(
    `Unable to determine context processor to load for file ${inputFile}, does it exist? `
  );
}
