import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedClientAuthCredentials = ParsedAsset<'clientAuthCredentials', null>;

async function parse(_context: YAMLContext): Promise<ParsedClientAuthCredentials> {
  return { clientAuthCredentials: null };
}

async function dump(_context: YAMLContext): Promise<ParsedClientAuthCredentials> {
  return { clientAuthCredentials: null };
}

const clientAuthCredentialsHandler: YAMLHandler<ParsedClientAuthCredentials> = {
  parse,
  dump,
};

export default clientAuthCredentialsHandler;
