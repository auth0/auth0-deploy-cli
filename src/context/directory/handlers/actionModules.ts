import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, loadJSON, sanitize, dumpJSON } from '../../../utils';
import log from '../../../logger';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { ActionModule } from '../../../tools/auth0/handlers/actionModules';

type ParsedActionModules = ParsedAsset<'actionModules', Asset[]>;

function parse(context: DirectoryContext): ParsedActionModules {
  const modulesFolder = path.join(context.filePath, constants.ACTION_MODULES_DIRECTORY);

  if (!existsMustBeDir(modulesFolder)) return { actionModules: null };

  const files = getFiles(modulesFolder, ['.json']);
  const actionModules = files.map((file) => {
    const module = {
      ...loadJSON(file, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    const moduleFolder = path.join(constants.ACTION_MODULES_DIRECTORY, `${module.name}`);

    if (module.code) {
      // The `module.code` can be a file path. It needs to be loaded.
      // It can be a relative path, so we need to handle both cases.
      const unixPath = module.code.replace(/[\\/]+/g, '/').replace(/^([a-zA-Z]+:|\.\/)/, '');
      if (fs.existsSync(unixPath)) {
        module.code = context.loadFile(unixPath, moduleFolder);
      } else {
        module.code = context.loadFile(path.join(context.filePath, module.code), moduleFolder);
      }
    }

    return module;
  });

  return { actionModules };
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

function mapModuleCode(filePath, module) {
  const { code } = module;

  if (!code) {
    return '';
  }

  const moduleName = sanitize(module.name);
  const moduleFolder = path.join(filePath, constants.ACTION_MODULES_DIRECTORY, `${moduleName}`);
  fs.ensureDirSync(moduleFolder);

  const codeFile = path.join(moduleFolder, 'code.js');
  log.info(`Writing ${codeFile}`);
  fs.writeFileSync(codeFile, code);

  return `./${constants.ACTION_MODULES_DIRECTORY}/${moduleName}/code.js`;
}

function mapToActionModule(filePath, module, includeIdentifiers: boolean): Partial<ActionModule> {
  return {
    ...(includeIdentifiers && module.id ? { id: module.id } : {}),
    name: module.name,
    code: mapModuleCode(filePath, module),
    dependencies: module.dependencies,
    secrets: mapSecrets(module.secrets),
    actions_using_module_total: module.actions_using_module_total,
    all_changes_published: module.all_changes_published,
    latest_version_number: module.latest_version_number,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { actionModules } = context.assets;
  if (!actionModules) return;

  // Create action modules folder
  const modulesFolder = path.join(context.filePath, constants.ACTION_MODULES_DIRECTORY);
  fs.ensureDirSync(modulesFolder);
  const includeIdentifiers = Boolean(context.config.AUTH0_EXPORT_IDENTIFIERS);

  actionModules.forEach((module) => {
    const name = sanitize(module.name);
    const moduleFile = path.join(modulesFolder, `${name}.json`);
    dumpJSON(moduleFile, mapToActionModule(context.filePath, module, includeIdentifiers));
  });
}

const actionModulesHandler: DirectoryHandler<ParsedActionModules> = {
  parse,
  dump,
};

export default actionModulesHandler;
