#!/usr/bin/env node
import { bootstrap } from 'global-agent';

import { getParams, CliParams } from './args';
import log from './logger';
import tools from './tools';
import { Stage } from './tools/auth0';

import importCMD from './commands/import';
import exportCMD from './commands/export';

async function run(params: CliParams): Promise<void> {
  // Run command
  const command = params._[0];

  const proxy = params.proxy_url;

  if (proxy) {
    const MAJOR_NODEJS_VERSION = parseInt(process.version.slice(1).split('.')[0], 10);

    if (MAJOR_NODEJS_VERSION < 10) {
      // `global-agent` works with Node.js v10 and above.
      throw new Error('The --proxy_url option is only supported on Node >= 10');
    }

    process.env.GLOBAL_AGENT_HTTP_PROXY = proxy;
    bootstrap();
  }

  log.debug(`Start command ${command}`);
  if (['deploy', 'import'].includes(command) && 'input_file' in params) {
    await importCMD(params);
  }
  if (['dump', 'export'].includes(command) && 'output_folder' in params) {
    await exportCMD(params);
  }
  log.debug(`Finished command ${command}`);
}

// Only run if from command line
if (require.main === module) {
  // Load cli params
  const params = getParams();

  log.debug('Starting Auth0 Deploy CLI Tool');

  if (params.debug) {
    log.level = 'debug';
    // Set for tools
    process.env.AUTH0_DEBUG = 'true';
    process.env.AUTH0_LOG = 'debug';
  }

  run(params)
    .then(() => process.exit(0))
    .catch((error: { type?: string; stage?: Stage; message?: string; stack?: string }) => {
      const command = params._[0];
      if (error.type || error.stage) {
        log.error(
          `Problem running command ${command} during stage ${error.stage} when processing type ${error.type}`
        );
      } else {
        log.error(`Problem running command ${command}`);
      }

      const msg = error.message || error.toString();
      log.error(msg);

      if (process.env.AUTH0_DEBUG === 'true' && error.stack) {
        log.debug(error.stack);
      }

      if (typeof msg === 'string' && msg.includes('Payload validation error')) {
        log.info(
          'Please refer to the Auth0 Management API docs for expected payloads: https://auth0.com/docs/api/management/v2'
        );
      }
      process.exit(1);
    });
}

// Export commands to be used programmatically
export default {
  deploy: importCMD,
  dump: exportCMD,
  import: importCMD,
  export: exportCMD,
  tools,
};

export const dump = exportCMD;
export const deploy = importCMD;
