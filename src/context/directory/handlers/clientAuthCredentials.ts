import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedClientAuthCredentials = ParsedAsset<'clientAuthCredentials', null>;

function parse(_context: DirectoryContext): ParsedClientAuthCredentials {
  return { clientAuthCredentials: null };
}

async function dump(_context: DirectoryContext): Promise<void> {
  // Credentials are embedded inside each client's JSON file — nothing to dump separately.
}

const clientAuthCredentialsHandler: DirectoryHandler<ParsedClientAuthCredentials> = {
  parse,
  dump,
};

export default clientAuthCredentialsHandler;
