import path from 'path';
import { AuthenticationClient, ManagementClient } from 'auth0';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';

export default async function(config) {
  // Validate config
  const required = [ 'AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET' ];
  const errors = required.filter(r => !config[r]);
  if (errors.length > 0) {
    throw new Error(`The following parameters were missing. Please add them to your config.json or as an environment variable. ${JSON.stringify(errors)}`);
  }

  const authClient = new AuthenticationClient({
    domain: config.AUTH0_DOMAIN,
    clientId: config.AUTH0_CLIENT_ID,
    clientSecret: config.AUTH0_CLIENT_SECRET
  });

  const clientCredentials = await authClient.clientCredentialsGrant({ audience: `https://${config.AUTH0_DOMAIN}/api/v2/` });
  const mgmtClient = new ManagementClient({
    domain: config.AUTH0_DOMAIN,
    token: clientCredentials.access_token
  });

  const inputFile = config.AUTH0_INPUT_FILE;

  if (typeof filePath === 'object') {
    return new YAMLContext(config, mgmtClient);
  }

  if (isDirectory(inputFile)) {
    return new DirectoryContext(config, mgmtClient);
  }

  const ext = path.extname(inputFile);
  if (ext === '.yaml' || ext === '.yml') {
    return new YAMLContext(config, mgmtClient);
  }

  throw new Error(`Unable to determine context processor to load for file ${inputFile}`);
}
