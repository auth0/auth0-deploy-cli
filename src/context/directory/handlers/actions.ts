/* eslint-disable consistent-return */
import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';
import log from '../../../logger';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { Action, isMarketplaceAction } from '../../../tools/auth0/handlers/actions';

type ParsedActions = ParsedAsset<'actions', Asset[]>;

function parse(context: DirectoryContext): ParsedActions {
  const actionsFolder = path.join(context.filePath, constants.ACTIONS_DIRECTORY);

  if (!existsMustBeDir(actionsFolder)) return { actions: null }; // Skip

  const files = getFiles(actionsFolder, ['.json']);
  const actions = files.map((file) => {
    const action = {
      ...loadJSON(file, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    const actionFolder = path.join(constants.ACTIONS_DIRECTORY, `${action.name}`);

    if (action.code) {
      const toUnixPath = (somePath) =>
        somePath.replace(/[\\/]+/g, '/').replace(/^([a-zA-Z]+:|\.\/)/, '');
      action.code = context.loadFile(toUnixPath(action.code), actionFolder);
    }

    return action;
  });

  return { actions };
}

function mapSecrets(secrets) {
  if (secrets && secrets.length > 0) {
    return secrets.map((secret) => ({ name: secret.name, value: secret.value }));
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

function mapToAction(filePath, action): Partial<Action> {
  return {
    name: action.name,
    code: mapActionCode(filePath, action),
    runtime: action.runtime,
    status: action.status,
    dependencies: action.dependencies,
    secrets: mapSecrets(action.secrets),
    supported_triggers: action.supported_triggers,
    deployed: action.deployed || action.all_changes_deployed,
    installed_integration_id: action.installed_integration_id,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { actions } = context.assets;
  if (!actions) return;

  // Marketplace actions are not currently supported for management (See ESD-23225)
  const filteredActions = actions.filter((action) => {
    if (isMarketplaceAction(action)) {
      log.warn(
        `Skipping export of marketplace action "${action.name}". Management of marketplace actions are not currently supported.`
      );
      return false;
    }
    return true;
  });

  // Create Actions folder
  const actionsFolder = path.join(context.filePath, constants.ACTIONS_DIRECTORY);
  fs.ensureDirSync(actionsFolder);
  filteredActions.forEach((action) => {
    // Dump template metadata
    const name = sanitize(action.name);
    const actionFile = path.join(actionsFolder, `${name}.json`);
    log.info(`Writing ${actionFile}`);
    fs.writeFileSync(actionFile, JSON.stringify(mapToAction(context.filePath, action), null, 2));
  });
}

const actionsHandler: DirectoryHandler<ParsedActions> = {
  parse,
  dump,
};

export default actionsHandler;
