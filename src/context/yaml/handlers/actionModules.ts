import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { sanitize } from '../../../utils';
import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { ActionModule } from '../../../tools/auth0/handlers/actionModules';

type ParsedActionModules = ParsedAsset<'actionModules', Partial<ActionModule>[]>;

async function parse(context: YAMLContext): Promise<ParsedActionModules> {
  const { actionModules } = context.assets;

  if (!actionModules) return { actionModules: null };

  return {
    actionModules: [
      ...actionModules.map((module) => ({
        ...module,
        code: context.loadFile(module.code || ''),
      })),
    ],
  };
}

function mapSecrets(secrets) {
  if (typeof secrets === 'string') {
    return secrets;
  }
  if (secrets && secrets.length > 0) {
    return secrets.map((secret) => ({ name: secret.name, value: secret.value }));
  }
  return [];
}

function mapModuleCode(basePath: string, module: ActionModule): string {
  const { code } = module;

  if (!code) {
    return '';
  }

  const moduleName = sanitize(module.name);
  const modulesFolder = path.join(basePath, constants.ACTION_MODULES_DIRECTORY, moduleName);
  fs.ensureDirSync(modulesFolder);

  const codeFile = path.join(modulesFolder, 'code.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, code);

  return `./${constants.ACTION_MODULES_DIRECTORY}/${moduleName}/code.js`;
}

async function dump(context: YAMLContext): Promise<ParsedActionModules> {
  const { actionModules } = context.assets;

  if (!actionModules || actionModules.length === 0) return { actionModules: null };

  const includeIdentifiers = Boolean(context.config.AUTH0_EXPORT_IDENTIFIERS);

  return {
    actionModules: actionModules?.map((module) => ({
      ...(includeIdentifiers && module.id ? { id: module.id } : {}),
      name: module.name,
      code: mapModuleCode(context.basePath, module),
      dependencies: module.dependencies || [],
      secrets: mapSecrets(module.secrets),
      actions_using_module_total: module.actions_using_module_total,
      all_changes_published: module.all_changes_published,
      latest_version_number: module.latest_version_number,
    })),
  };
}

const ActionModulesHandler: YAMLHandler<ParsedActionModules> = {
  parse,
  dump,
};

export default ActionModulesHandler;
