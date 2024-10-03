import { lstatSync, readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { AuthenticationClient, ManagementClient } from 'auth0';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';
import log from '../logger';
import { AssetTypes, Config } from '../types';

const { version: packageVersion } = require('../../package.json');

const nonPrimitiveProps: (keyof Config)[] = [
  // List of properties that are arrays or objects. This list
  // enables decoding of string env variables for these configurations.
  'AUTH0_KEYWORD_REPLACE_MAPPINGS',
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

export const setupContext = async (
  config: Config,
  command: 'import' | 'export'
): Promise<DirectoryContext | YAMLContext> => {
  const missingParams: (
    | 'AUTH0_DOMAIN'
    | 'AUTH0_CLIENT_ID'
    | 'AUTH0_CLIENT_SECRET or AUTH0_CLIENT_SIGNING_KEY_PATH or AUTH0_ACCESS_TOKEN'
  )[] = [];

  if (!config.AUTH0_DOMAIN) missingParams.push('AUTH0_DOMAIN');
  if (!config.AUTH0_ACCESS_TOKEN) {
    if (!config.AUTH0_CLIENT_ID) missingParams.push('AUTH0_CLIENT_ID');
    if (!config.AUTH0_CLIENT_SECRET && !config.AUTH0_CLIENT_SIGNING_KEY_PATH)
      missingParams.push(
        'AUTH0_CLIENT_SECRET or AUTH0_CLIENT_SIGNING_KEY_PATH or AUTH0_ACCESS_TOKEN'
      );
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
      throw new Error(
        'Need to define at least one resource type in AUTH0_INCLUDED_ONLY configuration. See: https://github.com/auth0/auth0-deploy-cli/blob/master/docs/configuring-the-deploy-cli.md#auth0_included_only'
      );
    }

    const hasExcludedResources =
      config.AUTH0_EXCLUDED !== undefined && config.AUTH0_EXCLUDED.length > 0;
    const hasIncludedResources = config.AUTH0_INCLUDED_ONLY.length > 0;

    if (hasExcludedResources && hasIncludedResources) {
      throw new Error(
        'Both AUTH0_EXCLUDED and AUTH0_INCLUDED_ONLY configuration values are defined, only one can be configured at a time. See: https://github.com/auth0/auth0-deploy-cli/blob/master/docs/excluding-from-management.md'
      );
    }
  })(config);

  ((config: Config) => {
    if (command === 'import') return;

    const shouldPreserveKeywords =
      //@ts-ignore because the string=>boolean conversion may not have happened if passed-in as env var
      config.AUTH0_PRESERVE_KEYWORDS === 'true' || config.AUTH0_PRESERVE_KEYWORDS === true;

    if (!shouldPreserveKeywords) return;

    const isKeywordMappingsEmpty =
      config.AUTH0_KEYWORD_REPLACE_MAPPINGS === undefined ||
      Object.keys(config.AUTH0_KEYWORD_REPLACE_MAPPINGS).length === 0;

    if (isKeywordMappingsEmpty) {
      throw new Error(
        'Attempting to preserve keywords without defining keyword mappings. Doing so could result in unintentional overwriting of resource configurations. Either define keyword mappings via AUTH0_KEYWORD_REPLACE_MAPPINGS or disable AUTH0_PRESERVE_KEYWORDS.'
      );
    }

    const doLocalFilesExist = (() => {
      if (!existsSync(config.AUTH0_INPUT_FILE)) return false;

      const isDirectory = lstatSync(config.AUTH0_INPUT_FILE).isDirectory();
      if (isDirectory) {
        return readdirSync(config.AUTH0_INPUT_FILE).length > 0;
      }
      return existsSync(config.AUTH0_INPUT_FILE);
    })();

    if (!doLocalFilesExist) {
      throw new Error(
        'Attempting to preserve keywords for local resource configuration files that do not exist. Ensure that there are resource files in the output directory or disable AUTH0_PRESERVE_KEYWORDS.'
      );
    }
  })(config);

  ((config: Config) => {
    // Detect and warn on usage of deprecated exclusion params. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props
    const deprecatedExclusionParams: (keyof Config)[] = [
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
    const {
      AUTH0_DOMAIN,
      AUTH0_CLIENT_ID,
      AUTH0_ACCESS_TOKEN,
      AUTH0_CLIENT_SECRET,
      AUTH0_CLIENT_SIGNING_KEY_PATH,
      AUTH0_CLIENT_SIGNING_ALGORITHM,
    } = config;

    if (!!AUTH0_ACCESS_TOKEN) return AUTH0_ACCESS_TOKEN;
    if (!AUTH0_CLIENT_SECRET && !AUTH0_CLIENT_SIGNING_KEY_PATH) {
      throw new Error(
        'need to supply either `AUTH0_ACCESS_TOKEN`, `AUTH0_CLIENT_SECRET` or `AUTH0_CLIENT_SIGNING_KEY_PATH`'
      );
    }

    const authClient: AuthenticationClient = (() => {
      if (!!AUTH0_CLIENT_SECRET) {
        return new AuthenticationClient({
          domain: AUTH0_DOMAIN,
          clientId: AUTH0_CLIENT_ID,
          clientSecret: AUTH0_CLIENT_SECRET,
        });
      }

      return new AuthenticationClient({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        clientAssertionSigningKey: readFileSync(AUTH0_CLIENT_SIGNING_KEY_PATH, 'utf8'),
        clientAssertionSigningAlg: !!AUTH0_CLIENT_SIGNING_ALGORITHM
          ? AUTH0_CLIENT_SIGNING_ALGORITHM
          : undefined,
      });
    })();

    const clientCredentials = await authClient.oauth.clientCredentialsGrant({
      audience: config.AUTH0_AUDIENCE
        ? config.AUTH0_AUDIENCE
        : `https://${config.AUTH0_DOMAIN}/api/v2/`,
    });
    const clientAccessToken = clientCredentials.data?.access_token;
    if (!clientAccessToken) {
      throw new Error('Failed to retrieve access token.');
    }
    return clientAccessToken;
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

export const filterOnlyIncludedResourceTypes =
  (includedAssetTypes: AssetTypes[] | undefined) =>
  ([handlerName, _]: [AssetTypes, any]) => {
    if (includedAssetTypes === undefined) return true;
    return includedAssetTypes.includes(handlerName);
  };
