import path from 'path';
import { AuthenticationClient, ManagementClient } from 'auth0';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';
import log from '../logger';
import { Config } from '../types';

const { version: packageVersion } = require('../../package.json');

const nonPrimitiveProps: (keyof Config)[] = [
  // List of properties that are arrays or objects. This list
  // enables decoding of string env variables for these configurations.
  'AUTH0_KEYWORD_REPLACE_MAPPINGS',
  'AUTH0_EXCLUDED_RULES',
  'AUTH0_EXCLUDED_CLIENTS',
  'AUTH0_EXCLUDED_DATABASES',
  'AUTH0_EXCLUDED_CONNECTIONS',
  'AUTH0_EXCLUDED_RESOURCE_SERVERS',
  'AUTH0_EXCLUDED_DEFAULTS',
  'AUTH0_EXCLUDED',
  'AUTH0_INCLUDED_ONLY',
  'EXCLUDED_PROPS',
  'INCLUDED_PROPS',
];

export const setupContext = async (config: Config): Promise<DirectoryContext | YAMLContext> => {
  const missingParams: ('AUTH0_DOMAIN' | 'AUTH0_CLIENT_ID' | 'AUTH0_CLIENT_SECRET')[] = [];

  if (!config.AUTH0_DOMAIN) missingParams.push('AUTH0_DOMAIN');
  if (!config.AUTH0_ACCESS_TOKEN) {
    if (!config.AUTH0_CLIENT_ID) missingParams.push('AUTH0_CLIENT_ID');
    if (!config.AUTH0_CLIENT_SECRET) missingParams.push('AUTH0_CLIENT_SECRET');
  }

  if (missingParams.length > 0) {
    throw new Error(
      `The following parameters were missing. Please add them to your config.json or as an environment variable. ${JSON.stringify(
        missingParams
      )}`
    );
  }

  ((config: Config) => {
    if (config.AUTH0_INCLUDED_ONLY === undefined) return;

    if (config.AUTH0_INCLUDED_ONLY.length === 0) {
      throw new Error(`Need to define at least one resource in AUTH0_INCLUDED_ONLY configuration.`);
    }

    const hasExcludedResources =
      config.AUTH0_EXCLUDED !== undefined && config.AUTH0_EXCLUDED.length > 0;
    const hasIncludedResources = config.AUTH0_INCLUDED_ONLY.length > 0;

    if (hasExcludedResources && hasIncludedResources) {
      throw new Error(
        `Both AUTH0_EXCLUDED and AUTH0_INCLUDED_ONLY configuration values are defined`
      );
    }
  })(config);

  ((config: Config) => {
    // Detect and warn on usage of deprecated exclusion params. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props
    const deprecatedExclusionParams: (keyof Config)[] = [
      'AUTH0_EXCLUDED_RULES',
      'AUTH0_EXCLUDED_CLIENTS',
      'AUTH0_EXCLUDED_DATABASES',
      'AUTH0_EXCLUDED_CONNECTIONS',
      'AUTH0_EXCLUDED_RESOURCE_SERVERS',
      'AUTH0_EXCLUDED_DEFAULTS',
    ];
    const usedDeprecatedParams = deprecatedExclusionParams.filter((deprecatedParam) => {
      const deprecatedConfigValue = config[deprecatedParam] as string[] | undefined;
      return !!deprecatedConfigValue && deprecatedConfigValue.length > 0;
    });
    if (usedDeprecatedParams.length > 0) {
      log.warn(
        `Usage of the ${usedDeprecatedParams.join(', ')} exclusion ${
          usedDeprecatedParams.length > 1 ? 'params are' : 'param is'
        } deprecated and may be removed from future major versions. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props for details.`
      );
    }
  })(config);

  const accessToken = await (async (): Promise<string> => {
    if (!!config.AUTH0_ACCESS_TOKEN) return config.AUTH0_ACCESS_TOKEN;

    const authClient = new AuthenticationClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_CLIENT_ID,
      clientSecret: config.AUTH0_CLIENT_SECRET,
    });

    const clientCredentials = await authClient.clientCredentialsGrant({
      audience: config.AUTH0_AUDIENCE
        ? config.AUTH0_AUDIENCE
        : `https://${config.AUTH0_DOMAIN}/api/v2/`,
    });
    return clientCredentials.access_token;
  })();

  const mgmtClient = new ManagementClient({
    domain: config.AUTH0_DOMAIN,
    token: accessToken,
    retry: { maxRetries: config.AUTH0_API_MAX_RETRIES || 10, enabled: true },
    headers: {
      'User-agent': `deploy-cli/${packageVersion} (node.js/${process.version.replace('v', '')})`,
    },
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

  throw new Error(
    `Unable to determine context processor to load for file ${inputFile}, does it exist? `
  );
};
