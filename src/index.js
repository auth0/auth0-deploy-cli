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
if (params.level && params.level.toLowerCase() === 'debug') {
  // Set for auth0-source-control-ext-tools
  process.env.AUTH0_DEBUG = 'true';
}
log.debug(`Setting log to level ${params.level}`);

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
  const proxy = args.proxy_url;
  if (proxy) {
    const proxyAgent = new HttpProxyAgent(proxy);
    const proxyAgentSsl = new HttpsProxyAgent(proxy);
    const OrigRequest = superagent.Request;
    superagent.Request = function RequestWithAgent(method, url) {
      const req = new OrigRequest(method, url);
      log.debug(`Setting proxy for ${method} to ${url}`);
      if (url.startsWith('https')) return req.agent(proxyAgentSsl);
      return req.agent(proxyAgent);
    };
  }

  log.debug(`Start command ${params._[0]}`);
  await cmd(params);
  log.debug(`Finished command ${params._[0]}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('We received an error :(');
    if (error.stack) {
      log.error(error.stack);
    }
    if (error.message) {
      log.error(JSON.stringify(error.message));
    }
    process.exit(1);
  });
