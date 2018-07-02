#!/usr/bin/env node
import os from 'os';
import username from 'username';
import moment from 'moment/moment';
import nconf from 'nconf';
import HttpsProxyAgent from 'https-proxy-agent';
import HttpProxyAgent from 'http-proxy-agent';
import superagent from 'superagent';
import extTools from 'auth0-extension-tools';
import { ManagementClient, AuthenticationClient } from 'auth0';
import tools from 'auth0-source-control-extension-tools';

import { logger } from 'src/logger';
import args from 'src/args';
import Storage from 'src/storage';
import setupContext from 'src/context';

export async function deploy(params) {
  const {
    input_file: inputFile,
    config_file: configFile,
    state_file: stateFile,
    proxy_url: proxyURL,
    config: configJSON,
    secret
  } = params;

  // Prepare configuration by initializing nconf, then passing that as the provider to the config object
  // Allow passed in secret to override the configured one
  if (secret) {
    nconf.overrides({ AUTH0_CLIENT_SECRET: secret });
  }

  // Allow environment variables to override the configuration file
  if (configJSON) {
    nconf
      .env(configJSON);
  } else {
    nconf
      .env()
      .file(configFile);
  }

  const config = extTools.config();
  config.setProvider(key => nconf.get(key));

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

  // Setup Context depending on directory or YAML
  const context = setupContext(inputFile, config('mappings') || []);

  // Execute deploy
  const userName = await username();
  const progress = {
    id: userName,
    user: userName,
    sha: moment()
      .format(),
    branch: os.hostname(),
    repository: 'Auth0 Deploy CLI'
  };

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

  // Before running deploy, let's copy excluded rules to storage
  // TODO: Look at this as it's more for directory context support
  const storage = new Storage(stateFile);
  const data = await storage.read();
  data.excluded_rules = config('AUTH0_EXCLUDED_RULES') || [];
  await storage.write(data);

  return tools.deploy(progress, context, mgmtClient, storage, config, {
    repository: 'Tool',
    id: 'Username',
    branch: 'Host',
    sha: 'Date/Time'
  });
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
