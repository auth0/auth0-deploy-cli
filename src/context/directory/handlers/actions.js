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
    action.current_version.code = context.loadFile(action.current_version.code, constants.ACTIONS_DIRECTORY);
    action.name = action.name.toLowerCase().replace(/\s/g, '-');
    return action;
  });

  return {
    actions
  };
}

function mapCurrentVersion(filePath, action) {
  const version = action.current_version;

  if (!version) {
    return {};
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(filePath, constants.ACTIONS_DIRECTORY);
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder, `${actionName}.js`);
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, version.code);

  return {
    status: version.status,
    code: `./${actionName}.js`,
    number: version.number,
    dependencies: version.dependencies || [],
    secrets: version.secrets || [],
    runtime: version.runtime,
    created_at: version.created_at,
    updated_at: version.updated_at
  };
}

function mapToAction(filePath, action) {
  return {
    name: action.name,
    supported_triggers: action.supported_triggers,
    current_version: mapCurrentVersion(filePath, action),
    bindings: action.bindings.map(binding => ({
      trigger_id: binding.trigger_id
    }))
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
