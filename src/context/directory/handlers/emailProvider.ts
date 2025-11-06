import path from 'path';
import fs from 'fs-extra';
import dotProp from 'dot-prop';
import { constants } from '../../../tools';

import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { emailProviderDefaults } from '../../defaults';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedEmailProvider = ParsedAsset<'emailProvider', Asset>;

function parse(context: DirectoryContext): ParsedEmailProvider {
  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(emailsFolder)) return { emailProvider: null }; // Skip

  const providerFile = path.join(emailsFolder, 'provider.json');

  if (isFile(providerFile)) {
    return {
      emailProvider: loadJSON(providerFile, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
  }

  return { emailProvider: null };
}

async function dump(context: DirectoryContext): Promise<void> {
  if (!context.assets.emailProvider) return; // Skip, nothing to dump

  let emailProvider: typeof context.assets.emailProvider = (() => {
    const excludedDefaults = context.assets.exclude?.defaults || [];
    if (!excludedDefaults.includes('emailProvider')) {
      // Add placeholder for credentials as they cannot be exported
      return emailProviderDefaults(context.assets.emailProvider);
    }
    return context.assets.emailProvider;
  })();

  // Apply EXCLUDED_PROPS after emailProviderDefaults to remove any re-added fields
  const excludedFields = context.config.EXCLUDED_PROPS?.emailProvider || [];
  if (excludedFields.length > 0) {
    emailProvider = { ...emailProvider };
    excludedFields.forEach((field) => {
      dotProp.delete(emailProvider, field);
    });
  }

  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(emailsFolder);

  const emailProviderFile = path.join(emailsFolder, 'provider.json');
  dumpJSON(emailProviderFile, emailProvider);
}

const emailProviderHandler: DirectoryHandler<ParsedEmailProvider> = {
  parse,
  dump,
};

export default emailProviderHandler;
