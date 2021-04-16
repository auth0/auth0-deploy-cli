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
    const actionFolder = path.join(constants.ACTIONS_DIRECTORY, `${action.name}`)
    action.code = context.loadFile(action.code, actionFolder);
    if(action.current_version && JSON.stringify(action.current_version) !== JSON.stringify({})){
      action.current_version.code = context.loadFile(action.current_version.code, constants.ACTIONS_DIRECTORY);
    }
    return action;
  });
  return {
    actions
  };
}

function mapCurrentVersion(filePath, action) {
  const version = action.current_version;

  if (!version) {
    return;
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(filePath, constants.ACTIONS_DIRECTORY, `${actionName}`);
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder,`current_version.js`);
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, version.code);

  return {
    status: version.status,
    code: `${codeFile}`,
    number: version.number,
    dependencies: version.dependencies || [],
    secrets: version.secrets || [],
    runtime: version.runtime,
    created_at: version.created_at,
    updated_at: version.updated_at
  };
}

function mapActionCode(filePath, action) {
  const code = action.code;

  if (!code) {
    return "";
  }

  const actionName = sanitize(action.name);
  const actionFolder = path.join(filePath, constants.ACTIONS_DIRECTORY, `${actionName}`);
  fs.ensureDirSync(actionFolder);

  const codeFile = path.join(actionFolder,`code.js`);
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
    secrets: action.secrets || [],
    runtime: action.runtime,
    supported_triggers: action.supported_triggers,
    current_version: mapCurrentVersion(filePath, action)
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
    const actionFile = path.join(actionsFolder, name ,`${name}.json`);
    log.info(`Writing ${actionFile}`);
    fs.writeFileSync(actionFile, JSON.stringify(mapToAction(context.filePath, action), null, 2));
  });
}

export default {
  parse,
  dump
};
