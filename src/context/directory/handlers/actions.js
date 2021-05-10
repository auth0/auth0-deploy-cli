/* eslint-disable consistent-return */
import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';
import log from '../../../logger';


function parse(context) {
  const actionsFolder = path.join(context.filePath, constants.ACTIONS_DIRECTORY);
  if (!existsMustBeDir(actionsFolder)) return { actions: undefined }; // Skip
  const files = getFiles(actionsFolder, [ '.json' ]);
  const actions = files.map((file) => {
    const action = { ...loadJSON(file, context.mappings) };
    const actionFolder = path.join(constants.ACTIONS_DIRECTORY, `${action.name}`);
    if (action.code) {
      action.code = context.loadFile(action.code, actionFolder);
    }
    return action;
  });
  return {
    actions
  };
}

function mapSecrets(secrets) {
  if (secrets && secrets.length > 0) {
    return secrets.map(secret => ({ name: secret.name, value: secret.value }));
  }
  return [];
}

function mapActionCode(filePath, action) {
  const { code } = action;

  if (!code) {
    return '';
  }

  const actionName = sanitize(action.name);
  const actionFolder = path.join(filePath, constants.ACTIONS_DIRECTORY, `${actionName}`);
  fs.ensureDirSync(actionFolder);

  const codeFile = path.join(actionFolder, 'code.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, code);

  return `${codeFile}`;
}

function mapToAction(filePath, action) {
  return {
    name: action.name,
    code: mapActionCode(filePath, action),
    status: action.status,
    dependencies: action.dependencies || [],
    secrets: mapSecrets(action.secrets),
    supported_triggers: action.supported_triggers,
    deployed: action.deployed
  };
}

async function dump(context) {
  const actions = [ ...context.assets.actions || [] ];
  if (actions.length < 1) return;

  // Create Actions folder
  const actionsFolder = path.join(context.filePath, constants.ACTIONS_DIRECTORY);
  fs.ensureDirSync(actionsFolder);
  actions.forEach((action) => {
    // Dump template metadata
    const name = sanitize(action.name);
    const actionFile = path.join(actionsFolder, `${name}.json`);
    log.info(`Writing ${actionFile}`);
    fs.writeFileSync(actionFile, JSON.stringify(mapToAction(context.filePath, action), null, 2));
  });
}

export default {
  parse,
  dump
};
