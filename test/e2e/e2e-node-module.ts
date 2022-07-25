import { dump, deploy } from '../../src';
import path from 'path';

const workDirectory = './local/node-module';

['AUTH0_E2E_TENANT_DOMAIN', 'AUTH0_E2E_CLIENT_ID', 'AUTH0_E2E_CLIENT_SECRET'].forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`${key} environment variable not set.`);
  }
});

const AUTH0_DOMAIN = process.env['AUTH0_E2E_TENANT_DOMAIN'];
const AUTH0_CLIENT_ID = process.env['AUTH0_E2E_CLIENT_ID'];
const AUTH0_CLIENT_SECRET = process.env['AUTH0_E2E_CLIENT_SECRET'];

(async () => {
  await dump({
    output_folder: workDirectory,
    format: 'yaml',
    config: {
      AUTH0_DOMAIN,
      AUTH0_CLIENT_ID,
      AUTH0_CLIENT_SECRET,
    },
  }).catch((err) => {
    console.log('Error during dump:', err);
  });

  await deploy({
    input_file: path.join(workDirectory, 'tenant.yaml'),
    config: {
      AUTH0_DOMAIN,
      AUTH0_CLIENT_ID,
      AUTH0_CLIENT_SECRET,
    },
  }).catch((err) => {
    console.log('Error during deploy:', err);
  });
})();
