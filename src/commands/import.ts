import nconf from 'nconf';
import { configFactory } from '../configFactory';
import { deploy as toolsDeploy } from '../tools';
import log from '../logger';
import { setupContext } from '../context';
import { ImportParams } from '../args';

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
  const context = await setupContext(nconf.get(), 'import');
  await context.loadAssetsFromLocal();

  const config = configFactory();
  config.setProvider((key) => nconf.get(key));

  //@ts-ignore because context and assets still need to be typed TODO: type assets and type context
  await toolsDeploy(context.assets, context.mgmtClient, config);

  log.info('Import Successful');

  log.info(`
  ================================================
  ======= Help us improve Auth0 Deploy CLI =======
  ================================================
  We're on a mission to make Auth0 Deploy CLI the best it can be, and we need YOUR help.
  We've put together a brief survey to understand how you use Deploy CLI, what you love about it, and where you think we can do better.

  ===> https://www.surveymonkey.com/r/LZKMPFN  <===

  Thank you for helping us make Auth0 Deploy CLI better for everyone!
  ================================================`);
}
