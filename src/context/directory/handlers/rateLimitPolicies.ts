import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { RateLimitPolicy } from '../../../tools/auth0/handlers/rateLimitPolicies';

type ParsedRateLimitPolicies = ParsedAsset<'rateLimitPolicies', RateLimitPolicy[]>;

function parse(context: DirectoryContext): ParsedRateLimitPolicies {
  const rateLimitPoliciesDirectory = path.join(
    context.filePath,
    constants.RATE_LIMIT_POLICIES_DIRECTORY
  );
  if (!existsMustBeDir(rateLimitPoliciesDirectory)) return { rateLimitPolicies: null }; // Skip

  const foundFiles = getFiles(rateLimitPoliciesDirectory, ['.json']);

  const rateLimitPolicies = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return { rateLimitPolicies };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { rateLimitPolicies } = context.assets;

  if (!rateLimitPolicies) return; // Skip, nothing to dump

  const rateLimitPoliciesDirectory = path.join(
    context.filePath,
    constants.RATE_LIMIT_POLICIES_DIRECTORY
  );
  fs.ensureDirSync(rateLimitPoliciesDirectory);

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at'];

  rateLimitPolicies.forEach((policy) => {
    const policyToWrite = { ...policy };
    removeKeysFromOutput.forEach((key) => {
      delete policyToWrite[key];
    });

    const fileName = sanitize(policy.consumer_selector);
    const filePath = path.join(rateLimitPoliciesDirectory, `${fileName}.json`);
    dumpJSON(filePath, policyToWrite);
  });
}

const rateLimitPoliciesHandler: DirectoryHandler<ParsedRateLimitPolicies> = {
  parse,
  dump,
};

export default rateLimitPoliciesHandler;
