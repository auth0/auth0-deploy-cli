import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedExperiments = ParsedAsset<'experiments', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedExperiments> {
  const { experiments } = context.assets;

  if (!experiments) return { experiments: null };

  return {
    experiments,
  };
}

async function dump(context: YAMLContext): Promise<ParsedExperiments> {
  const { experiments } = context.assets;

  if (!experiments) return { experiments: null };

  return {
    experiments,
  };
}

const experimentsHandler: YAMLHandler<ParsedExperiments> = {
  parse,
  dump,
};

export default experimentsHandler;
