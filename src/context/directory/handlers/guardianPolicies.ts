import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

type ParsedGuardianPolicies =
  | {
      guardianPolicies: unknown[];
    }
  | {};

function parse(context: DirectoryContext): ParsedGuardianPolicies {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return {}; // Skip

  const file = path.join(guardianFolder, 'policies.json');

  if (isFile(file)) {
    return {
      guardianPolicies: loadJSON(file, context.mappings),
    };
  }

  return {} as ParsedGuardianPolicies;
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
