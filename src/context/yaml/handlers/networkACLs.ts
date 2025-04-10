import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { NetworkACL } from '../../../tools/auth0/handlers/networkACLs';
import log from '../../../logger';

type ParsedNetworkACLs = ParsedAsset<'networkACLs', NetworkACL[]>;

async function parse(context: YAMLContext): Promise<ParsedNetworkACLs> {
  const { networkACLs } = context.assets;

  if (!networkACLs) return { networkACLs: null };

  return {
    networkACLs,
  };
}

async function dump(context: YAMLContext): Promise<ParsedNetworkACLs> {
  let { networkACLs } = context.assets;

  if (!networkACLs) return { networkACLs: null };

  if (Array.isArray(networkACLs) && networkACLs.length === 0) {
    log.info('No network ACLs available, skipping dump');
    return { networkACLs: null };
  }

  const removeKeysFromOutput = ['created_at', 'updated_at'];

  networkACLs = networkACLs.map((networkACL) => {
    removeKeysFromOutput.forEach((key) => {
      if (key in networkACL) {
        delete networkACL[key];
      }
    });

    return networkACL;
  });

  return {
    networkACLs,
  };
}

const networkACLsHandler: YAMLHandler<ParsedNetworkACLs> = {
  parse,
  dump,
};

export default networkACLsHandler;
