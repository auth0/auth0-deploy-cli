/* eslint-disable consistent-return */
import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';

function parseCurrentVersion(context, version) {
  if (version) {
    return {
      code: context.loadFile(version.code, constants.ACTIONS_DIRECTORY),
      dependencies: version.dependencies || [],
      secrets: version.secrets || [],
      runtime: version.runtime
    };
  }
}

async function parse(context) {
  // Load the script file for each action
  if (!context.assets.actions) return [];
  const actions = {
    actions: [
      ...context.assets.actions.map(action => ({
        ...action,
        current_version: parseCurrentVersion(context, action.current_version)
      }))
    ]
  };
  return actions;
}

function mapCurrentVersion(basePath, action) {
  const version = action.current_version;

  if (!version) {
    return {};
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(
    basePath,
    constants.ACTIONS_DIRECTORY
  );
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder, `${actionName}.js`);
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, version.code);

  return {
    status: version.status,
    code: `./${constants.ACTIONS_DIRECTORY}/${actionName}.js`,
    number: version.number,
    dependencies: version.dependencies || [],
    secrets: version.secrets || [],
    runtime: version.runtime,
    created_at: version.created_at,
    updated_at: version.updated_at
  };
}

async function dump(context) {
  const { actions } = context.assets;
  // Nothing to do
  if (!actions) return {};

  return {
    actions: actions.map(action => ({
      name: action.name,
      supported_triggers: action.supported_triggers,
      current_version: mapCurrentVersion(context.basePath, action),
      bindings: action.bindings.map(binding => ({ trigger_id: binding.trigger_id }))
    }))
  };
}

export default {
  parse,
  dump
};
