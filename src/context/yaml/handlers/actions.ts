/* eslint-disable consistent-return */
import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';
import { YAMLHandler } from '.'
import YAMLContext from '..'

type ParsedActions = {
  actions: unknown[] | undefined
} | []

type Secret = { name: string, value: string }

function parseCode(context: YAMLContext, code: string) {
  if (code) {
    //@ts-ignore TODO: understand why two arguments are passed when context.loadFile only accepts one
    return context.loadFile(code, constants.ACTIONS_DIRECTORY);
  }
}

async function parse(context: YAMLContext): Promise<ParsedActions> {
  // Load the script file for each action
  if (!context.assets.actions) return [];
  const actions = {
    actions: [
      ...context.assets.actions.map((action) => ({
        ...action,
        code: parseCode(context, action.code)
      }))
    ]
  };
  return actions;
}

function mapSecrets(secrets: { name: string, value: string }[]): Secret[] {
  if (secrets && secrets.length > 0) {
    return secrets.map((secret) => ({ name: secret.name, value: secret.value }));
  }
  return [];
}

function mapActionCode(basePath: string, action: { code: string, name: string }): string {
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

async function dump(context: YAMLContext): Promise<ParsedActions> {
  const { actions } = context.assets;
  //@ts-ignore TODO: need to investigate why returning void here when other handlers do not
  if (!actions) return;// Nothing to do
  return {
    actions: actions.map((action) => ({
      name: action.name,
      deployed: action.deployed || action.all_changes_deployed,
      //@ts-ignore because Action resource needs to be typed more accurately
      code: mapActionCode(context.basePath, action),
      runtime: action.runtime,
      dependencies: action.dependencies || [],
      status: action.status,
      secrets: mapSecrets(action.secrets),
      supported_triggers: action.supported_triggers
    }))
  };
}

const ActionsHandler: YAMLHandler<ParsedActions> = {
  parse,
  dump
};

export default ActionsHandler;