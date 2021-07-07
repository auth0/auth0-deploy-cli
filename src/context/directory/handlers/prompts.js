import path from 'path';
import {
  existsMustBeDir, isFile, dumpJSON, loadJSON
} from '../../../utils';

function parse(context) {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return {}; // Skip

  const promptsFile = path.join(baseFolder, 'prompts.json');

  if (isFile(promptsFile)) {
    /* eslint-disable camelcase */
    const prompts = loadJSON(promptsFile, context.mappings);

    return {
      prompts: prompts
    };
    /* eslint-enable camelcase */
  }

  return {};
}

async function dump(context) {
  const { prompts } = context.assets;

  if (!prompts) return; // Skip, nothing to dump

  const promptsFile = path.join(context.filePath, 'prompts.json');
  dumpJSON(promptsFile, prompts);
}

export default {
  parse,
  dump
};
