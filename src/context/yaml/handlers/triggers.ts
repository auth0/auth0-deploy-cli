import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTriggers = ParsedAsset<'triggers', Asset>;

async function parse(context: YAMLContext): Promise<ParsedTriggers> {
  // Load the script file for each action
  if (!context.assets.triggers) return { triggers: null };
  return {
    triggers: context.assets.triggers,
  };
}

async function dump(context: YAMLContext): Promise<ParsedTriggers> {
  const { triggers } = context.assets;
  // Nothing to do
  if (!triggers) return { triggers: null };
  return {
    triggers: triggers,
  };
}

const triggersHandler: YAMLHandler<ParsedTriggers> = {
  parse,
  dump,
};

export default triggersHandler;
