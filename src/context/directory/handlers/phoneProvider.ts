import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { phoneProviderDefaults } from '../../defaults';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedPhoneProvider = ParsedAsset<'phoneProviders', Asset>;

function parse(context: DirectoryContext): ParsedPhoneProvider {
  const phoneProvidersFolder = path.join(context.filePath, constants.PHONE_PROVIDER_DIRECTORY);
  if (!existsMustBeDir(phoneProvidersFolder)) return { phoneProviders: null }; // Skip

  const providerFile = path.join(phoneProvidersFolder, 'provider.json');

  if (isFile(providerFile)) {
    return {
      phoneProviders: loadJSON(providerFile, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
  }

  return { phoneProviders: null };
}

async function dump(context: DirectoryContext): Promise<void> {
  if (!context.assets.phoneProviders) return; // Skip, nothing to dump

  const phoneProviders: typeof context.assets.phoneProviders = (() => {
    const excludedDefaults = context.assets.exclude?.defaults || [];
    if (!excludedDefaults.includes('phoneProviders')) {
      // Add placeholder for credentials as they cannot be exported
      return phoneProviderDefaults(context.assets.phoneProviders);
    }
    return context.assets.phoneProviders;
  })();

  const phoneProvidersFolder = path.join(context.filePath, constants.PHONE_PROVIDER_DIRECTORY);
  fs.ensureDirSync(phoneProvidersFolder);

  const phoneProviderFile = path.join(phoneProvidersFolder, 'provider.json');
  dumpJSON(phoneProviderFile, phoneProviders);
}

const phoneProvidersHandler: DirectoryHandler<ParsedPhoneProvider> = {
  parse,
  dump,
};

export default phoneProvidersHandler;
