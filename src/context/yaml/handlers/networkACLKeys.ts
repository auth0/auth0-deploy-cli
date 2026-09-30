import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { NetworkAclKey } from '../../../tools/auth0/handlers/networkACLKeys';
import log from '../../../logger';

type ParsedNetworkACLKeys = ParsedAsset<'networkACLKeys', NetworkAclKey[]>;

async function parse(context: YAMLContext): Promise<ParsedNetworkACLKeys> {
  const { networkACLKeys } = context.assets;

  if (!networkACLKeys) return { networkACLKeys: null };

  return {
    networkACLKeys,
  };
}

async function dump(context: YAMLContext): Promise<ParsedNetworkACLKeys> {
  let { networkACLKeys } = context.assets;

  if (!networkACLKeys) return { networkACLKeys: null };

  if (Array.isArray(networkACLKeys) && networkACLKeys.length === 0) {
    log.info('No network ACL keys available, skipping dump');
    return { networkACLKeys: null };
  }

  // value is write-only — never returned by the API and must not be exported.
  // created_at and updated_at are API-generated metadata; not needed in config.
  const removeKeysFromOutput = ['value', 'created_at', 'updated_at'];

  networkACLKeys = networkACLKeys.map((key) => {
    const out = { ...key };
    removeKeysFromOutput.forEach((k) => {
      if (k in out) delete out[k];
    });
    return out;
  });

  return {
    networkACLKeys,
  };
}

const networkACLKeysHandler: YAMLHandler<ParsedNetworkACLKeys> = {
  parse,
  dump,
};

export default networkACLKeysHandler;
