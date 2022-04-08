import yargs from 'yargs';
import { Config } from './types';

type SharedParams = {
  proxy_url?: string;
  debug?: boolean;
  config_file?: string;
  env?: boolean;
  secret?: string;
  base_path?: string; // Necessary when package imported as Node module
  config?: Partial<Config>;
};

type ImportSpecificParams = {
  input_file: string;
};

type ExportSpecificParams = {
  format: 'yaml' | 'directory';
  output_folder: string;
  export_ids?: boolean;
};

export type ExportParams = ExportSpecificParams & SharedParams;
export type ImportParams = ImportSpecificParams & SharedParams;

export type CliParams = (ExportParams | ImportParams) & {
  _: ['export' | 'import' | 'deploy' | 'dump'];
};

function getParams(): CliParams {
  const args = yargs
    .demandCommand(1, 'A command is required')
    .usage('Auth0 Deploy CLI')
    .option('debug', {
      alias: 'd',
      describe: 'Dump extra debug information.',
      type: 'boolean',
      default: false,
    })
    .option('proxy_url', {
      alias: 'p',
      describe: 'A url for proxying requests, only set this if you are behind a proxy.',
      type: 'string',
    })
    .command(['import', 'deploy'], 'Deploy Configuration', {
      input_file: {
        alias: 'i',
        describe:
          'The updates to deploy. Either a JSON file, or directory that contains the correct file layout. See README and online for more info.',
        type: 'string',
        demandOption: true,
      },
      config_file: {
        alias: 'c',
        describe: 'The JSON configuration file.',
        type: 'string',
      },
      env: {
        describe: 'Override the mappings in config with environment variables.',
        boolean: true,
        default: true,
      },
      secret: {
        alias: 'x',
        describe:
          'The client secret, this allows you to encrypt the secret in your build configuration instead of storing it in a config file',
        type: 'string',
      },
    })
    .command(['export', 'dump'], 'Export Auth0 Tenant Configuration', {
      output_folder: {
        alias: 'o',
        describe: 'The output directory.',
        type: 'string',
        demandOption: true,
      },
      format: {
        alias: 'f',
        describe: 'The output format.',
        type: 'string',
        choices: ['yaml', 'directory'],
        demandOption: true,
      },
      config_file: {
        alias: 'c',
        describe: 'The JSON configuration file.',
        type: 'string',
      },
      secret: {
        alias: 'x',
        describe:
          'The client secret, this allows you to encrypt the secret in your build configuration instead of storing it in a config file',
        type: 'string',
      },
      env: {
        describe: 'Override the mappings in config with environment variables.',
        boolean: true,
        default: false,
      },
      export_ids: {
        alias: 'e',
        describe: 'Export identifier field for each object type.',
        type: 'boolean',
        default: false,
      },
    })
    .example(
      '$0 export -c config.json -f yaml -o path/to/export',
      'Dump Auth0 config to folder in YAML format'
    )
    .example(
      '$0 export -c config.json -f directory -o path/to/export',
      'Dump Auth0 config to folder in directory format'
    )
    .example('$0 import -c config.json -i tenant.yaml', 'Deploy Auth0 via YAML')
    .example('$0 import -c config.json -i path/to/files', 'Deploy Auth0 via Path')
    .example(
      '$0 dump -c config.json -f yaml -o path/to/export',
      'Dump Auth0 config to folder in YAML format'
    )
    .example(
      '$0 dump -c config.json -f directory -o path/to/export',
      'Dump Auth0 config to folder in directory format'
    )
    .example('$0 deploy -c config.json -i tenant.yaml', 'Deploy Auth0 via YAML')
    .example('$0 deploy -c config.json -i path/to/files', 'Deploy Auth0 via Path')
    .epilogue(
      'See README (https://github.com/auth0/auth0-deploy-cli) for more in-depth information on configuration and setup.'
    )
    .wrap(null);
  //@ts-ignore because we know these types are either ExportParams or ImportParams. TODO: fix more native way of inferring types from yargs
  return args.argv;
}

export default {
  getParams,
};

export { getParams };
