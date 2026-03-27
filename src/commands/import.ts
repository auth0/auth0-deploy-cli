import nconf from 'nconf';
import { configFactory } from '../configFactory';
import { deploy as toolsDeploy } from '../tools';
import log from '../logger';
import { setupContext } from '../context';
import { ImportParams } from '../args';
import { isTruthy } from '../utils';

export default async function importCMD(params: ImportParams) {
  const {
    input_file: inputFile,
    base_path: basePath,
    config_file: configFile,
    config: configObj,
    env: shouldInheritEnv = false,
    secret: clientSecret,
    experimental_ea: experimentalEA,
    dry_run: dryRun,
    interactive = false,
    apply = false,
  } = params;

  const normalizedDryRun = dryRun === true || dryRun === '' ? 'preview' : dryRun;
  let effectiveDryRun: 'preview' | undefined;

  if (!normalizedDryRun) {
    effectiveDryRun = undefined;
  } else if (normalizedDryRun !== 'preview') {
    throw new Error(
      `Invalid value for --dry-run: ${normalizedDryRun}. Use --dry-run or --dry-run=preview.`
    );
  } else {
    effectiveDryRun = normalizedDryRun;
  }

  if (apply && !effectiveDryRun) {
    throw new Error('--apply must be used with --dry-run.');
  }

  if (interactive && !effectiveDryRun) {
    throw new Error('--interactive must be used with --dry-run.');
  }

  if (interactive && apply) {
    throw new Error('--interactive and --apply cannot be used together.');
  }

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

  // Overrides AUTH0_EXPERIMENTAL_EA if experimental_ea is passed in command line
  if (experimentalEA) {
    overrides.AUTH0_EXPERIMENTAL_EA = experimentalEA;

    // nconf.overrides() sometimes doesn't work, so we need to set it manually to ensure it's set
    nconf.set('AUTH0_EXPERIMENTAL_EA', experimentalEA);
  }

  // Override AUTH0_DRY_RUN if dry_run passed in command line
  if (effectiveDryRun) {
    overrides.AUTH0_DRY_RUN = effectiveDryRun;
    nconf.set('AUTH0_DRY_RUN', effectiveDryRun);
  }
  if (interactive) {
    overrides.AUTH0_DRY_RUN_INTERACTIVE = interactive;
    nconf.set('AUTH0_DRY_RUN_INTERACTIVE', interactive);
  }
  const existingDryRunApply = nconf.get('AUTH0_DRY_RUN_APPLY');
  if (apply || isTruthy(existingDryRunApply)) {
    overrides.AUTH0_DRY_RUN_APPLY = true;
    nconf.set('AUTH0_DRY_RUN_APPLY', true);
  }

  nconf.overrides(overrides);

  // Setup context and load
  const context = await setupContext(nconf.get(), 'import');
  await context.loadAssetsFromLocal();

  const config = configFactory();
  config.setProvider((key) => nconf.get(key));

  // @ts-ignore because context and assets still need to be typed TODO: type assets and type context
  await toolsDeploy(context.assets, context.mgmtClient, config);

  if (!effectiveDryRun) {
    log.info('Import Successful');
  }
}
