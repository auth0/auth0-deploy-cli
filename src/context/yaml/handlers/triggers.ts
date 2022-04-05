import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedTriggers =
  | {
      triggers: unknown[];
    }
  | {};

async function parse(context: YAMLContext): Promise<ParsedTriggers> {
  // Load the script file for each action
  if (!context.assets.triggers) return {};
  return {
    triggers: context.assets.triggers,
  };
}

async function dump(context: YAMLContext): Promise<ParsedTriggers> {
  const { triggers } = context.assets;
  // Nothing to do
  if (!triggers) return {};
  return {
    triggers: triggers,
  };
}

const triggersHandler: YAMLHandler<ParsedTriggers> = {
  parse,
  dump,
};

export default triggersHandler;
