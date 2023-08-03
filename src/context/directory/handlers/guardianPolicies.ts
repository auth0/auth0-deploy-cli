import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianPolicies = ParsedAsset<'guardianPolicies', Asset[]>;

function parse(context: DirectoryContext): ParsedGuardianPolicies {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianPolicies: null }; // Skip

  const file = path.join(guardianFolder, 'policies.json');

  if (!isFile(file)) {
    return { guardianPolicies: null };
  }

  return {
    guardianPolicies: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext) {
  const { guardianPolicies } = context.assets;

  if (!guardianPolicies) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'policies.json');
  dumpJSON(file, guardianPolicies);
}

const guardianPoliciesHandler: DirectoryHandler<ParsedGuardianPolicies> = {
  parse,
  dump,
};

export default guardianPoliciesHandler;
