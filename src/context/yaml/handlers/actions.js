/* eslint-disable consistent-return */
import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';

function parseCode(context, code) {
  if (code) {
    return context.loadFile(code, constants.ACTIONS_DIRECTORY);
  }
}

async function parse(context) {
  // Load the script file for each action
  if (!context.assets.actions) return [];
  const actions = {
    actions: [
      ...context.assets.actions.map(action => ({
        ...action,
        code: parseCode(context, action.code)
      }))
    ]
  };
  return actions;
}

function mapSecrets(secrets) {
  if (secrets && secrets.length > 0) {
    return secrets.map(secret => ({ name: secret.name, value: secret.value }));
  }
  return [];
}

function mapActionCode(basePath, action) {
  const { code } = action;

  if (!code) {
    return '';
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(
    basePath,
    constants.ACTIONS_DIRECTORY,
    actionName
  );
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder, 'code.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, code);

  return `./${constants.ACTIONS_DIRECTORY}/${actionName}/code.js`;
}

async function dump(context) {
  const { actions } = context.assets;
  // Nothing to do
  if (!actions) return;
  return {
    actions: actions.map(action => ({
      name: action.name,
      deployed: action.deployed,
      code: mapActionCode(context.basePath, action),
      dependencies: action.dependencies || [],
      status: action.status,
      secrets: mapSecrets(action.secrets),
      supported_triggers: action.supported_triggers
    }))
  };
}

export default {
  parse,
  dump
};
