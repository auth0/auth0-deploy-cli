import path from 'path';
import nconf from 'nconf';
import mkdirp from 'mkdirp';

import log from '../logger';
import { isDirectory } from '../utils';
import setupContext from '../context';

export default async function deploy(params) {
  const {
    output_folder: outputFolder,
    base_path: basePath,
    config_file: configFile,
    config: configObj,
    strip,
    secret
  } = params;

  nconf.env().use('memory');

  if (configFile) {
    nconf.file(configFile);
  }

  const overrides = {
    AUTH0_INPUT_FILE: outputFolder,
    AUTH0_BASE_PATH: basePath,
    AUTH0_CONFIG_FILE: configFile,
    AUTH0_STRIP_IDENTIFIERS: strip,
    ...configObj || {}
  };

  // Prepare configuration by initializing nconf, then passing that as the provider to the config object
  // Allow passed in secret to override the configured one
  if (secret) {
    overrides.AUTH0_CLIENT_SECRET = secret;
  }

  // Check output folder
  if (!isDirectory(outputFolder)) {
    log.info(`Creating ${outputFolder}`);
    mkdirp.sync(outputFolder);
  }

  if (params.format === 'yaml') {
    overrides.AUTH0_INPUT_FILE = path.join(outputFolder, 'tenant.yaml');
  }

  nconf.overrides(overrides);

  // Setup context and load
  const context = await setupContext(nconf.get());
  await context.dump();
  log.info('Export Successful');
}
