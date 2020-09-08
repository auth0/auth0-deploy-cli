import path from 'path';
import fs from 'fs-extra';
import { sanitize } from '../../../utils';
import log from '../../../logger';

async function parse(context) {
    // Load the script file for each action
    if (!context.assets.actions) return {};
    return { actions: context.assets.actions}
}


function mapActionVersions(basePath, action) {

// Create action versions folder
if (action.versions.length === 0){
    return []
}
const actionName = sanitize(action.name);
const actionVersionsFolder = path.join(basePath, 'actions', actionName);
fs.ensureDirSync(actionVersionsFolder);

return action.versions.map((version) => {
  const codeFile = path.join(actionVersionsFolder, `v${version.number}.js`);
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, version.code);

  return {
    id: version.id,
    status: version.status,
    code: `${codeFile}`,
    number: version.number,
    dependencies: version.dependencies,
    runtime: version.runtime,
  }})
}

async function dump(context) {
  const { actions } = context.assets;

  // Nothing to do
  if (!actions) return {};

  return {
      actions: actions.map((action) => {
        return {
          id: action.id,
          name: action.name,
          supported_triggers: action.supported_triggers,
          required_configuration: action.required_configuration,
          required_secrets: action.required_secrets,
          versions: mapActionVersions(context.basePath,action)
        };
      })
    };
}

export default {
  parse,
  dump
};
