import path from 'path';
import { AuthenticationClient, ManagementClient } from 'auth0';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';
import log from '../logger';
import { Config } from '../types'

const { version: packageVersion } = require('../../package.json')

const nonPrimitiveProps: (keyof Config)[] = [
  'AUTH0_KEYWORD_REPLACE_MAPPINGS',
  'AUTH0_EXCLUDED_RULES',
  'AUTH0_EXCLUDED_CLIENTS',
  'AUTH0_EXCLUDED_DATABASES',
  'AUTH0_EXCLUDED_CONNECTIONS',
  'AUTH0_EXCLUDED_RESOURCE_SERVERS',
  'AUTH0_EXCLUDED_DEFAULTS',
  'AUTH0_EXCLUDED',
  'EXCLUDED_PROPS',
  'INCLUDED_PROPS'
];

export const setupContext = async (config: Config): Promise<DirectoryContext | YAMLContext> => {
  // Validate config
  const missingParams: ("AUTH0_DOMAIN" | "AUTH0_CLIENT_ID" | "AUTH0_CLIENT_SECRET")[] = [];

  if (!config.AUTH0_DOMAIN) missingParams.push('AUTH0_DOMAIN');
  if (!config.AUTH0_ACCESS_TOKEN) {
    if (!config.AUTH0_CLIENT_ID) missingParams.push('AUTH0_CLIENT_ID');
    if (!config.AUTH0_CLIENT_SECRET) missingParams.push('AUTH0_CLIENT_SECRET');
  }

  if (missingParams.length > 0) {
    throw new Error(`The following parameters were missing. Please add them to your config.json or as an environment variable. ${JSON.stringify(missingParams)}`);
  }

  const accessToken = await (async (): Promise<string> => {
    if (!!config.AUTH0_ACCESS_TOKEN) return config.AUTH0_ACCESS_TOKEN;

    const authClient = new AuthenticationClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_CLIENT_ID,
      clientSecret: config.AUTH0_CLIENT_SECRET
    });

    const clientCredentials = await authClient.clientCredentialsGrant({
      audience: config.AUTH0_AUDIENCE ? config.AUTH0_AUDIENCE : `https://${config.AUTH0_DOMAIN}/api/v2/`
    });
    return clientCredentials.access_token;
  })()

  const mgmtClient = new ManagementClient({
    domain: config.AUTH0_DOMAIN,
    token: accessToken,
    retry: { maxRetries: config.AUTH0_API_MAX_RETRIES || 10, enabled: true },
    headers: {
      'User-agent': `deploy-cli/${packageVersion} (node.js/${process.version.replace('v', '')})`
    }
  });

  const inputFile = config.AUTH0_INPUT_FILE;

  const ensureObject = (key: keyof Config, value: any): any => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        log.debug(`Cannot convert config.${key} to an object. Error: ${e.message}`);
        return value;
      }
    }

    return value;
  };

  nonPrimitiveProps.forEach((key) => {
    if (config[key]) {
      //@ts-ignore because this method of config overwriting technically functions
      config[key] = ensureObject(key, config[key]);
    }
  });

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

  throw new Error(`Unable to determine context processor to load for file ${inputFile}, does it exist? `);
}