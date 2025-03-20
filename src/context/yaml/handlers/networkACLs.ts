import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { NetworkACL } from '../../../tools/auth0/handlers/networkACLs';

type ParsedNetworkACLs = ParsedAsset<'networkACLs', NetworkACL[]>;

async function parse(context: YAMLContext): Promise<ParsedNetworkACLs> {
  const { networkACLs } = context.assets;

  if (!networkACLs) return { networkACLs: null };

  return {
    networkACLs,
  };
}

async function dump(context: YAMLContext): Promise<ParsedNetworkACLs> {
  const { networkACLs } = context.assets;

  if (!networkACLs) return { networkACLs: null };

  return {
    networkACLs,
  };
}

const networkACLsHandler: YAMLHandler<ParsedNetworkACLs> = {
  parse,
  dump,
};

export default networkACLsHandler;
