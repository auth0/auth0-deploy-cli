import nconf from 'nconf';
import { configFactory } from '../configFactory';
import { deploy as toolsDeploy } from '../tools';
import log from '../logger';
import { setupContext } from '../context';
import { ImportParams } from '../args';
import { Assets, Config } from '../types';

export default async function importCMD(params: ImportParams) {
  const {
    input_file: inputFile,
    base_path: basePath,
    config_file: configFile,
    config: configObj,
    env: shouldInheritEnv = false,
    secret: clientSecret,
  } = params;

  if (shouldInheritEnv) {
    nconf.env().use('memory');

    const mappings = nconf.get('AUTH0_KEYWORD_REPLACE_MAPPINGS') || {};
    nconf.set('AUTH0_KEYWORD_REPLACE_MAPPINGS', Object.assign(mappings, process.env));
  }

  if (configFile) {
    nconf.file(configFile);
  }

  const overrides = {
    AUTH0_INPUT_FILE: inputFile,
    AUTH0_BASE_PATH: basePath,
    AUTH0_KEYWORD_REPLACE_MAPPINGS: {},
    ...(configObj || {}),
  };

  // Prepare configuration by initializing nconf, then passing that as the provider to the config object
  // Allow passed in secret to override the configured one
  if (clientSecret) {
    overrides.AUTH0_CLIENT_SECRET = clientSecret;
  }

  nconf.overrides(overrides);

  // Setup context and load
  const context = await setupContext(nconf.get());
  await context.load();

  const config = configFactory();
  config.setProvider((key) => nconf.get(key));

  findUnreplacedKeywords(context.assets);

  await toolsDeploy(context.assets, context.mgmtClient, config);

  log.info('Import Successful');
}

export const findUnreplacedKeywords = (assets: Assets) => {
  const recursiveFindUnreplacedKeywords = (target): string[] => {
    let unreplaced: string[] = [];
    if (target === undefined || target === null) return [];
    if (Array.isArray(target)) {
      target.forEach((child) => {
        unreplaced.push(...recursiveFindUnreplacedKeywords(child));
      });
    } else if (typeof target === 'object') {
      Object.values(target).forEach((child) => {
        unreplaced.push(...recursiveFindUnreplacedKeywords(child));
      });
    }

    if (typeof target === 'string') {
      const arrayMatches = target.match(/(?<=@@).*(?=@@)/g);
      if (arrayMatches !== null) {
        return arrayMatches;
      }
      const keywordMatches = target.match(/(?<=##).*(?=##)/g);
      if (keywordMatches !== null) {
        return keywordMatches;
      }
    }

    return unreplaced;
  };

  const unreplacedKeywords = recursiveFindUnreplacedKeywords(assets);

  if (unreplacedKeywords.length > 0) {
    throw `Unreplaced keywords found: ${unreplacedKeywords.join(
      ', '
    )}. Either correct these values or add to AUTH0_KEYWORD_REPLACE_MAPPINGS configuration.`;
  }
  return;
};
