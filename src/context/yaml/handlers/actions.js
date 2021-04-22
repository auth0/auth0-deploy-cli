/* eslint-disable consistent-return */
import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';

function parseCurrentVersion(context, version) {
  if (!version){
    return;
  }
  const isEmpty = !Object.values(version).some(x => (x !== null && x !== ''));
  if (!isEmpty) {
    return {
      code: context.loadFile(version.code, constants.ACTIONS_DIRECTORY),
      dependencies: version.dependencies || [],
      secrets: version.secrets || [],
      runtime: version.runtime
    };
  }
}

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
        code: parseCode(context, action.code),
        current_version: parseCurrentVersion(context, action.current_version)
      }))
    ]
  };
  return actions;
}

function mapSecrets(secrets){
  if(secrets && secrets.length > 0){
    return secrets.map(secret => ({name:secret.name, value: secret.value}))
  }
  return [];
}

function mapCurrentVersion(basePath, action) {
  const version = action.current_version;

  if (!version) {
    return {};
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(
    basePath,
    constants.ACTIONS_DIRECTORY,
    actionName
  );
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder, 'current_version.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, version.code);

  return {
    status: version.status,
    code: `./${constants.ACTIONS_DIRECTORY}/${actionName}/current_version.js`,
    number: version.number,
    ...(version.dependencies && {dependencies: version.dependencies}),
    ...(version.secrets && {secrets: mapSecrets(version.secrets)}),
    runtime: version.runtime
  };
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
  if (!actions) return {};
  return {
    actions: actions.map(action => ({
      name: action.name,
      code: mapActionCode(context.basePath, action),
      dependencies: action.dependencies || [],
      status: action.status,
      runtime: action.runtime,
      secrets:  mapSecrets(action.secrets),
      supported_triggers: action.supported_triggers,
      current_version: mapCurrentVersion(context.basePath, action)
    }))
  };
}

export default {
  parse,
  dump
};
