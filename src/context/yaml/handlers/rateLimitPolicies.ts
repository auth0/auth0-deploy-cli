import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { RateLimitPolicy } from '../../../tools/auth0/handlers/rateLimitPolicies';

type ParsedRateLimitPolicies = ParsedAsset<'rateLimitPolicies', RateLimitPolicy[]>;

async function parse(context: YAMLContext): Promise<ParsedRateLimitPolicies> {
  const { rateLimitPolicies } = context.assets;

  if (!rateLimitPolicies) return { rateLimitPolicies: null };

  return { rateLimitPolicies };
}

async function dump(context: YAMLContext): Promise<ParsedRateLimitPolicies> {
  const { rateLimitPolicies } = context.assets;

  if (!rateLimitPolicies) return { rateLimitPolicies: null };

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at'];

  const cleaned = rateLimitPolicies.map((policy) => {
    const policyToWrite = { ...policy };
    removeKeysFromOutput.forEach((key) => {
      delete policyToWrite[key];
    });
    return policyToWrite;
  });

  return { rateLimitPolicies: cleaned };
}

const rateLimitPoliciesHandler: YAMLHandler<ParsedRateLimitPolicies> = {
  parse,
  dump,
};

export default rateLimitPoliciesHandler;
