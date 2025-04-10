import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { NetworkACL } from '../../../tools/auth0/handlers/networkACLs';
import log from '../../../logger';

type ParsedNetworkACLs = ParsedAsset<'networkACLs', NetworkACL[]>;

function parse(context: DirectoryContext): ParsedNetworkACLs {
  const networkACLsDirectory = path.join(context.filePath, constants.NETWORK_ACLS_DIRECTORY);
  if (!existsMustBeDir(networkACLsDirectory)) return { networkACLs: null }; // Skip

  const foundFiles = getFiles(networkACLsDirectory, ['.json']);

  const networkACLs = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty configs

  return {
    networkACLs,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { networkACLs } = context.assets;

  if (!networkACLs) return; // Skip, nothing to dump

  if (Array.isArray(networkACLs) && networkACLs.length === 0) {
    log.info('No network ACLs available, skipping dump');
    return;
  }

  // Create Network ACLs folder
  const networkACLsDirectory = path.join(context.filePath, constants.NETWORK_ACLS_DIRECTORY);
  fs.ensureDirSync(networkACLsDirectory);

  const removeKeysFromOutput = ['created_at', 'updated_at'];

  networkACLs.forEach((networkACL) => {
    removeKeysFromOutput.forEach((key) => {
      if (key in networkACL) {
        delete networkACL[key];
      }
    });
    const fileName = networkACL.description
      ? `${sanitize(networkACL.description)}-p-${networkACL.priority}`
      : `network-acl-p-${networkACL.priority}`;
    const filePath = path.join(networkACLsDirectory, `${fileName}.json`);
    dumpJSON(filePath, networkACL);
  });
}

const networkACLsHandler: DirectoryHandler<ParsedNetworkACLs> = {
  parse,
  dump,
};

export default networkACLsHandler;
