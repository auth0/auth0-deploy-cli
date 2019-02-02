#!/usr/bin/env node
import HttpsProxyAgent from 'https-proxy-agent';
import HttpProxyAgent from 'http-proxy-agent';
import superagent from 'superagent';

import args from './args';
import commands from './commands';
import log from './logger';

// Load cli params
const params = args.argv;

log.debug('Starting Auth0 Deploy CLI Tool');

// Set log level
log.transports.console.level = params.level;
if (params.debug) {
  log.transports.console.level = 'debug';
  // Set for auth0-source-control-ext-tools
  process.env.AUTH0_DEBUG = 'true';
}

async function run() {
  // Run command
  const cmd = commands[params._[0]];

  // TODO: Prob a native/better way to enforce command choices in yargs.
  if (!cmd) {
    log.error(`Command ${params._[0]} not supported\n`);
    args.showHelp();
    process.exit(1);
  }

  // Monkey Patch the superagent for proxy use
  const proxy = params.proxy_url;
  if (proxy) {
    const proxyAgent = new HttpProxyAgent(proxy);
    const proxyAgentSsl = new HttpsProxyAgent(proxy);
    const OrigRequest = superagent.Request;
    superagent.Request = function RequestWithAgent(method, url) {
      const req = new OrigRequest(method, url);
      log.info(`Setting proxy for ${method} to ${url}`);
      if (url.startsWith('https')) return req.agent(proxyAgentSsl);
      return req.agent(proxyAgent);
    };
  }

  log.debug(`Start command ${params._[0]}`);
  await cmd(params);
  log.debug(`Finished command ${params._[0]}`);
}

// Only run if from command line
if (require.main === module) {
  run()
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

      if (msg.includes('Payload validation error')) {
        log.info('Please see https://github.com/auth0/auth0-deploy-cli#troubleshooting for common issues');
      }
      process.exit(1);
    });
}


// Export commands to be used programmatically
export const deploy = commands.import;
export const dump = commands.export;
export default {
  deploy: commands.import,
  dump: commands.export
};
