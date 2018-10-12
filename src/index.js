#!/usr/bin/env node
import args from './args';
import commands from './commands';
import log from './logger';

// Load cli params
const params = args.argv;

log.debug('Starting Auth0 Deploy CLI Tool');

// Set log level
log.transports.console.level = params.level;
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
    } else if (error.message) {
      log.error(JSON.stringify(error.message));
    }
    process.exit(1);
  });
