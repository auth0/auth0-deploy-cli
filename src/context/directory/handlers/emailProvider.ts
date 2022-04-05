import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import {
  existsMustBeDir, isFile, dumpJSON, loadJSON
} from '../../../utils';
import { emailProviderDefaults } from '../../defaults';
import { DirectoryHandler } from '.'
import DirectoryContext from '..';

type ParsedEmailProvider = {
  emailProvider: unknown
} | {}

function parse(context: DirectoryContext): ParsedEmailProvider {
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

async function dump(context: DirectoryContext): Promise<void> {
  let { emailProvider } = context.assets;

  if (!emailProvider) return; // Skip, nothing to dump

  const excludedDefaults = context.assets.exclude?.defaults || [];
  if (!excludedDefaults.includes('emailProvider')) {
    // Add placeholder for credentials as they cannot be exported
    emailProvider = emailProviderDefaults(emailProvider);
  }

  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(emailsFolder);

  const emailProviderFile = path.join(emailsFolder, 'provider.json');
  dumpJSON(emailProviderFile, emailProvider);
}

const emailProviderHandler: DirectoryHandler<ParsedEmailProvider> = {
  parse,
  dump,
}

export default emailProviderHandler;