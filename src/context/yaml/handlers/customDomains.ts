import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedCustomDomains = ParsedAsset<'customDomains', Asset[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedCustomDomains> {
  const { customDomains } = context.assets;

  if (!customDomains) return { customDomains: null };

  return {
    customDomains,
  };
}

const customDomainsHandler: YAMLHandler<ParsedCustomDomains> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default customDomainsHandler;
