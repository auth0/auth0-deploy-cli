#!/usr/bin/env node

import args from 'src/args';
import { logger } from 'src/logger';
import runDeploy from 'src/deploy';

export const deploy = runDeploy;
export async function run() {
  try {
    await runDeploy(args.argv);
  } catch (err) {
    logger.error(err);
  }
}

// Only run if from command line
if (require.main === module) {
  run()
    .catch(err => `Unknown error ${err}`);
}
