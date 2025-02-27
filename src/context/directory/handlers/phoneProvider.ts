import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { PhoneProvider } from '../../../tools/auth0/handlers/phoneProvider';

type ParsedPhoneProvider = ParsedAsset<'phoneProviders', PhoneProvider[]>;

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
  const { phoneProviders } = context.assets;
  if (!phoneProviders) {
    return;
  }// Skip, nothing to dump

  const phoneProvidersFolder = path.join(context.filePath, constants.PHONE_PROVIDER_DIRECTORY);
  fs.ensureDirSync(phoneProvidersFolder);

  const phoneProviderFile = path.join(phoneProvidersFolder, 'provider.json');

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'channel', 'tenant', 'credentials'];
  phoneProviders.forEach((provider) => {
    removeKeysFromOutput.forEach((key) => {
      if (key in provider) {
        delete provider[key];
      }
    });
  });

  dumpJSON(phoneProviderFile, phoneProviders);
}

const phoneProvidersHandler: DirectoryHandler<ParsedPhoneProvider> = {
  parse,
  dump,
};

export default phoneProvidersHandler;
