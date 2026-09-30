import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { NetworkAclKey } from '../../../tools/auth0/handlers/networkACLKeys';
import log from '../../../logger';

type ParsedNetworkACLKeys = ParsedAsset<'networkACLKeys', NetworkAclKey[]>;

function parse(context: DirectoryContext): ParsedNetworkACLKeys {
  const networkACLKeysDirectory = path.join(context.filePath, constants.NETWORK_ACL_KEYS_DIRECTORY);
  if (!existsMustBeDir(networkACLKeysDirectory)) return { networkACLKeys: null }; // Skip

  const foundFiles = getFiles(networkACLKeysDirectory, ['.json']);

  const networkACLKeys = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty configs

  return {
    networkACLKeys,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { networkACLKeys } = context.assets;

  if (!networkACLKeys) return; // Skip, nothing to dump

  if (Array.isArray(networkACLKeys) && networkACLKeys.length === 0) {
    log.info('No network ACL keys available, skipping dump');
    return;
  }

  const networkACLKeysDirectory = path.join(context.filePath, constants.NETWORK_ACL_KEYS_DIRECTORY);
  fs.ensureDirSync(networkACLKeysDirectory);

  // value is write-only — never returned by the API and must not be exported.
  // created_at and updated_at are API-generated metadata; not needed in config.
  const removeKeysFromOutput = ['value', 'created_at', 'updated_at'];

  networkACLKeys.forEach((networkACLKey) => {
    const out = { ...networkACLKey };
    removeKeysFromOutput.forEach((key) => {
      if (key in out) delete out[key];
    });
    const fileName = sanitize(networkACLKey.name);
    const filePath = path.join(networkACLKeysDirectory, `${fileName}.json`);
    dumpJSON(filePath, out);
  });
}

const networkACLKeysHandler: DirectoryHandler<ParsedNetworkACLKeys> = {
  parse,
  dump,
};

export default networkACLKeysHandler;
