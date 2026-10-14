import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedSegments = ParsedAsset<'segments', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedSegments> {
  const { segments } = context.assets;

  if (!segments) return { segments: null };

  return {
    segments,
  };
}

async function dump(context: YAMLContext): Promise<ParsedSegments> {
  const { segments } = context.assets;

  if (!segments) return { segments: null };

  return {
    segments,
  };
}

const segmentsHandler: YAMLHandler<ParsedSegments> = {
  parse,
  dump,
};

export default segmentsHandler;
