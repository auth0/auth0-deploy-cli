import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';

function parse(context) {
  const rolesFolder = path.join(context.filePath, constants.ROLES_DIRECTORY);
  if (!existsMustBeDir(rolesFolder)) return { roles: undefined }; // Skip

  const files = getFiles(rolesFolder, [ '.json' ]);

  const roles = files.map((f) => {
    const role = { ...loadJSON(f, context.mappings) };
    return role;
  });

  return {
    roles
  };
}

async function dump(context) {
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

    fs.writeFileSync(roleFile, JSON.stringify(role, null, 2));
  });
}

export default {
  parse,
  dump
};
