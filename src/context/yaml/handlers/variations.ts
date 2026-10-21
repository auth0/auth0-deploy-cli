import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedVariations = ParsedAsset<'variations', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedVariations> {
  const { variations } = context.assets;

  if (!variations) return { variations: null };

  return {
    variations,
  };
}

async function dump(context: YAMLContext): Promise<ParsedVariations> {
  const { variations } = context.assets;

  if (!variations) return { variations: null };

  return {
    variations,
  };
}

const variationsHandler: YAMLHandler<ParsedVariations> = {
  parse,
  dump,
};

export default variationsHandler;
