import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import log from '../../../logger';
import {
  getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..'

type ParsedRoles = {
  roles: unknown[] | undefined
}

function parse(context: DirectoryContext): ParsedRoles {
  const rolesFolder = path.join(context.filePath, constants.ROLES_DIRECTORY);
  if (!existsMustBeDir(rolesFolder)) return { roles: undefined }; // Skip

  const files = getFiles(rolesFolder, ['.json']);

  const roles = files.map((f) => {
    const role = { ...loadJSON(f, context.mappings) };
    return role;
  });

  return {
    roles
  };
}

async function dump(context: DirectoryContext) {
  const { roles } = context.assets;

  // API returns an empty object if no grants are present
  if (!roles || roles.constructor === Object) return; // Skip, nothing to dump

  const rolesFolder = path.join(context.filePath, constants.ROLES_DIRECTORY);
  fs.ensureDirSync(rolesFolder);

  roles.forEach((role) => {
    const roleFile = path.join(rolesFolder, sanitize(`${role.name}.json`));
    log.info(`Writing ${roleFile}`);

    // remove empty description
    if (role.description === null) {
      delete role.description;
    }

    dumpJSON(roleFile, role);
  });
}

const rolesHandler: DirectoryHandler<ParsedRoles> = {
  parse,
  dump,
}

export default rolesHandler;