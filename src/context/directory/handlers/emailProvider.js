import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { existsMustBeDir, isFile, loadJSON } from '../../../utils';

function parse(context) {
  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(emailsFolder)) return {}; // Skip

  const providerFile = path.join(emailsFolder, 'provider.json');

  if (isFile(providerFile)) {
    return {
      emailProvider: loadJSON(providerFile, context.mappings)
    };
  }

  return {};
}


async function dump(context) {
  const { emailProvider } = context.assets;

  if (!emailProvider) return; // Skip, nothing to dump

  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(emailsFolder);

  const emailProviderFile = path.join(emailsFolder, 'provider.json');
  log.info(`Writing ${emailProviderFile}`);
  fs.writeFileSync(emailProviderFile, JSON.stringify(emailProvider, null, 2));
}


export default {
  parse,
  dump
};
