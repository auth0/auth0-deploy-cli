#!/usr/bin/env node
import { bootstrap } from 'global-agent';

import { loadArguments } from './args';
import commands from './commands';
import log from './logger';

async function run(params) {
  // Run command
  const cmd = commands[params._[0]];
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

  log.debug(`Start command ${params._[0]}`);
  await cmd(params);
  log.debug(`Finished command ${params._[0]}`);
}

// Only run if from command line
if (require.main === module) {
  // Load cli params
  const params = loadArguments();

  log.debug('Starting Auth0 Deploy CLI Tool');

  // Set log level
  log.transports.console.level = params.level;
  if (params.debug) {
    log.transports.console.level = 'debug';
    // Set for auth0-source-control-ext-tools
    process.env.AUTH0_DEBUG = 'true';
    process.env.AUTH0_LOG = 'debug';
  }

  run(params)
    .then(() => process.exit(0))
    .catch((error) => {
      if (error.type || error.stage) {
        log.error(`Problem running command ${params._[0]} during stage ${error.stage} when processing type ${error.type}`);
      } else {
        log.error(`Problem running command ${params._[0]}`);
      }

      const msg = error.message || error.toString();
      log.error(msg);

      if (process.env.AUTH0_DEBUG === 'true') {
        log.debug(error.stack);
      }

      if (typeof msg === 'string' && msg.includes('Payload validation error')) {
        log.info('Please see https://github.com/auth0/auth0-deploy-cli#troubleshooting for common issues');
      }
      process.exit(1);
    });
}


// Export commands to be used programmatically
module.exports = {
  deploy: commands.import,
  dump: commands.export,
  import: commands.import,
  export: commands.export
};
