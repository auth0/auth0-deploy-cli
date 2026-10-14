import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedFeatureFlags = ParsedAsset<'featureFlags', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedFeatureFlags> {
  const { featureFlags } = context.assets;

  if (!featureFlags) return { featureFlags: null };

  return {
    featureFlags,
  };
}

async function dump(context: YAMLContext): Promise<ParsedFeatureFlags> {
  const { featureFlags } = context.assets;

  if (!featureFlags) return { featureFlags: null };

  return {
    featureFlags,
  };
}

const featureFlagsHandler: YAMLHandler<ParsedFeatureFlags> = {
  parse,
  dump,
};

export default featureFlagsHandler;
