import path from 'path';
import nconf from 'nconf';
import mkdirp from 'mkdirp';

import log from '../logger';
import { isDirectory } from '../utils';
import { setupContext } from '../context/index';
import { Config } from '../types';
import { ExportParams } from '../args';

export default async function exportCMD(params: ExportParams) {
  const {
    output_folder: outputFolder,
    base_path: basePath,
    config_file: configFile,
    config: configObj,
    export_ids: exportIds,
    secret: clientSecret,
    env: shouldInheritEnv = false,
    experimental_ea: experimentalEA,
  } = params;

  if (shouldInheritEnv) {
    nconf.env().use('memory');
  }

  if (configFile) {
    nconf.file(configFile);
  }

  const overrides: Partial<Config> = {
    AUTH0_INPUT_FILE: outputFolder,
    AUTH0_BASE_PATH: basePath,
    ...(configObj || {}),
  };

  // Prepare configuration by initializing nconf, then passing that as the provider to the config object
  // Allow passed in secret to override the configured one
  if (clientSecret) {
    overrides.AUTH0_CLIENT_SECRET = clientSecret;
  }

  // Allow passed in export_ids to override the configured one
  if (exportIds) {
    overrides.AUTH0_EXPORT_IDENTIFIERS = exportIds;
  }

  // Overrides AUTH0_INCLUDE_EXPERIMENTAL_EA is experimental_ea passed in command line
  if (experimentalEA) {
    overrides.AUTH0_EXPERIMENTAL_EA = experimentalEA;

    // nconf.overrides() sometimes doesn't work, so we need to set it manually to ensure it's set
    nconf.set('AUTH0_EXPERIMENTAL_EA', experimentalEA);
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
  const context = await setupContext(nconf.get(), 'export');
  await context.dump();

  log.info('Export Successful');
}
