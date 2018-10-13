#!/usr/bin/env node
import nconf from 'nconf';
import extTools from 'auth0-extension-tools';
import { ManagementClient, AuthenticationClient } from 'auth0';
import tools from 'auth0-source-control-extension-tools';

import setupContext from '../context';

export default async function deploy(params) {
  const {
    input_file: inputFile,
    base_path: basePath,
    config_file: configFile,
    env,
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

  if (env) {
    const mappings = nconf.get('AUTH0_KEYWORD_REPLACE_MAPPINGS') || {};
    nconf.set('AUTH0_KEYWORD_REPLACE_MAPPINGS', Object.assign(mappings, process.env));
  }

  const config = extTools.config();
  config.setProvider(key => nconf.get(key));

  // Validate config
  const required = [ 'AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET' ];
  const errors = required.filter(r => !config(r));
  if (errors.length > 0) {
    throw new Error(`The following parameters were missing. Please add them to your config.json or as an environment variable. ${JSON.stringify(errors)}`);
  }

  const mappings = config('AUTH0_KEYWORD_REPLACE_MAPPINGS') || {};

  const authClient = new AuthenticationClient({
    domain: config('AUTH0_DOMAIN'),
    clientId: config('AUTH0_CLIENT_ID'),
    clientSecret: config('AUTH0_CLIENT_SECRET')
  });

  const clientCredentials = await authClient.clientCredentialsGrant({ audience: `https://${config('AUTH0_DOMAIN')}/api/v2/` });
  const mgmtClient = new ManagementClient({
    domain: config('AUTH0_DOMAIN'),
    token: clientCredentials.access_token
  });

  // Setup context and load
  const context = setupContext(inputFile, mappings, basePath, mgmtClient);
  await context.load();

  // Before running deploy, get excluded rules
  context.assets.exclude = {
    rules: config('AUTH0_EXCLUDED_RULES') || [],
    resourceServers: config('AUTH0_EXCLUDED_RESOURCE_SERVERS') || []
  };

  return tools.deploy(context.assets, mgmtClient, config);
}
