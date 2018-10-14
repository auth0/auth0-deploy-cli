import yargs from 'yargs';

export default yargs
  .usage('Auth0 Deploy CLI')
  .option('verbose', {
    alias: 'v',
    describe: 'Dump extra debug information.',
    type: 'string',
    boolean: true,
    default: false
  })
  .option('proxy_url', {
    alias: 'p',
    describe: 'A url for proxying requests, only set this if you are behind a proxy.',
    type: 'string'
  })
  .command('deploy', 'Deploy Configuration', {
    input_file: {
      alias: 'i',
      describe: 'The updates to deploy. Either a JSON file, or directory that contains the correct file layout. See README and online for more info.',
      type: 'string',
      demandOption: true
    },
    config_file: {
      alias: 'c',
      describe: 'The JSON configuration file.',
      type: 'string'
    },
    env: {
      alias: 'e',
      describe: 'Override the mappings in config with process.env environment variables.',
      type: 'string',
      boolean: true,
      default: true
    },
    secret: {
      alias: 'x',
      describe: 'The client secret, this allows you to encrypt the secret in your build configuration instead of storing it in a config file',
      type: 'string'
    }
  })
  .command('dump', 'Dump Configuration', {
    output_file: {
      alias: 'o',
      describe: 'The output file or directory. Will dump YAML if .yaml file else will dump to directory structure',
      type: 'string',
      demandOption: true
    },
    config_file: {
      alias: 'c',
      describe: 'The JSON configuration file.',
      type: 'string'
    },
    strip: {
      alias: 's',
      describe: 'Strip the identifier field for each object type.',
      type: 'boolean',
      default: false
    },
    secret: {
      alias: 'x',
      describe: 'The client secret, this allows you to encrypt the secret in your build configuration instead of storing it in a config file',
      type: 'string'
    }
  })
  .example('$0 deploy -i tenant.yaml', 'Deploy Auth0 via YAML')
  .example('$0 deploy -c config.yml -i path/to/files', 'Deploy Auth0 via Path')
  .epilogue('See README (https://github.com/auth0/auth0-deploy-cli) for more in-depth information on configuration and setup.');
