/* eslint-disable consistent-return */
import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Action, isMarketplaceAction } from '../../../tools/auth0/handlers/actions';

type ParsedActions = ParsedAsset<'actions', Partial<Action>[]>;

type Secret = { name: string; value: string };

function parseCode(context: YAMLContext, code: string) {
  if (code) {
    //@ts-ignore TODO: understand why two arguments are passed when context.loadFile only accepts one
    return context.loadFile(code, constants.ACTIONS_DIRECTORY);
  }
}

async function parse(context: YAMLContext): Promise<ParsedActions> {
  // Load the script file for each action
  const { actions } = context.assets;

  if (!actions) return { actions: null };

  return {
    actions: [
      ...actions.map((action) => ({
        ...action,
        code: parseCode(context, action.code || ''),
      })),
    ],
  };
}

function mapSecrets(secrets: { name: string; value: string }[]): Secret[] {
  if (secrets && secrets.length > 0) {
    return secrets.map((secret) => ({ name: secret.name, value: secret.value }));
  }
  return [];
}

function mapActionCode(basePath: string, action: { code: string; name: string }): string {
  const { code } = action;

  if (!code) {
    return '';
  }

  const actionName = sanitize(action.name);
  const actionVersionsFolder = path.join(basePath, constants.ACTIONS_DIRECTORY, actionName);
  fs.ensureDirSync(actionVersionsFolder);

  const codeFile = path.join(actionVersionsFolder, 'code.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, code);

  return `./${constants.ACTIONS_DIRECTORY}/${actionName}/code.js`;
}

async function dump(context: YAMLContext): Promise<ParsedActions> {
  const { actions } = context.assets;

  if (!actions) return { actions: null };

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

  return {
    actions: filteredActions.map((action) => ({
      name: action.name,
      deployed: !!action.deployed || !!action.all_changes_deployed,
      //@ts-ignore because Action resource needs to be typed more accurately
      code: mapActionCode(context.basePath, action),
      runtime: action.runtime,
      dependencies: action.dependencies || [],
      status: action.status,
      secrets: mapSecrets(action.secrets || []),
      supported_triggers: action.supported_triggers,
    })),
  };
}

const ActionsHandler: YAMLHandler<ParsedActions> = {
  parse,
  dump,
};

export default ActionsHandler;
