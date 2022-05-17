import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedCustomDomains = ParsedAsset<'customDomains', Asset[]>;

const getCustomDomainsDirectory = (filePath: string) =>
  path.join(filePath, constants.CUSTOM_DOMAINS_DIRECTORY);

const getCustomDomainsFile = (filePath: string) =>
  path.join(getCustomDomainsDirectory(filePath), 'custom-domains.json');

function parse(context: DirectoryContext): ParsedCustomDomains {
  const customDomainsDirectory = getCustomDomainsDirectory(context.filePath);
  if (!existsMustBeDir(customDomainsDirectory)) return { customDomains: null }; // Skip

  const customDomainsFile = getCustomDomainsFile(context.filePath);

  return {
    customDomains: loadJSON(customDomainsFile, context.mappings),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { customDomains } = context.assets;

  if (!customDomains) return; // Skip, nothing to dump

  // Create Rules folder
  const customDomainsDirectory = getCustomDomainsDirectory(context.filePath);
  fs.ensureDirSync(customDomainsDirectory);

  const customDomainsFile = getCustomDomainsFile(context.filePath);
  dumpJSON(customDomainsFile, customDomains);
}

const customDomainsHandler: DirectoryHandler<ParsedCustomDomains> = {
  parse,
  dump,
};

export default customDomainsHandler;
