import nconf from 'nconf';

import setupContext from '../context';

export default async function deploy(params) {
  const {
    output_file: outputFile,
    base_path: basePath,
    config_file: configFile,
    strip,
    secret
  } = params;

  nconf.env().use('memory');

  if (configFile) {
    nconf.file(configFile);
  }

  // Prepare configuration by initializing nconf, then passing that as the provider to the config object
  // Allow passed in secret to override the configured one
  if (secret) {
    nconf.overrides({ AUTH0_CLIENT_SECRET: secret });
  }

  nconf.overrides({
    AUTH0_INPUT_FILE: outputFile,
    AUTH0_BASE_PATH: basePath,
    AUTH0_CONFIG_FILE: configFile,
    AUTH0_STRIP_IDENTIFIERS: strip
  });

  // Setup context and load
  const context = await setupContext(nconf.get());
  await context.dump();
}
