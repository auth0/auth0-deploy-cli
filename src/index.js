#!/usr/bin/env node
import nconf from 'nconf';
import HttpsProxyAgent from 'https-proxy-agent';
import HttpProxyAgent from 'http-proxy-agent';
import superagent from 'superagent';
import extTools from 'auth0-extension-tools';
import { ManagementClient, AuthenticationClient } from 'auth0';
import tools from 'auth0-source-control-extension-tools';

import { logger } from './logger';
import args from './args';
import setupContext from './context';

export async function deploy(params) {
  const {
    input_file: inputFile,
    base_path: basePath,
    config_file: configFile,
    proxy_url: proxyURL,
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

  // Monkey Patch the superagent for proxy use
  if (proxyURL) {
    const proxyAgent = new HttpProxyAgent(proxyURL);
    const proxyAgentSsl = new HttpsProxyAgent(proxyURL);
    const OrigRequest = superagent.Request;
    superagent.Request = function RequestWithAgent(method, url) {
      const req = new OrigRequest(method, url);
      logger.debug(`Setting proxy for ${method} to ${url}`);
      if (url.startsWith('https')) return req.agent(proxyAgentSsl);
      return req.agent(proxyAgent);
    };
  }

  const mappings = config('AUTH0_KEYWORD_REPLACE_MAPPINGS') || {};
  const context = setupContext(inputFile, mappings, basePath);

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

  // Before running deploy, get excluded rules
  context.assets.excluded_rules = config('AUTH0_EXCLUDED_RULES') || [];

  return tools.deploy(context, mgmtClient, config);
}

export async function run() {
  try {
    await deploy(args.argv);
  } catch (err) {
    logger.error(err);
  }
}

// Only run if from command line
if (require.main === module) {
  run()
    .catch(err => `Unknown error ${err}`);
}
