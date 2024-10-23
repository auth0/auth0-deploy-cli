import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Flow } from '../../../tools/auth0/handlers/flows';

type ParsedFlows = ParsedAsset<'flows', Flow[]>;

function parse(context: DirectoryContext): ParsedFlows {
  const flowsFolder = path.join(context.filePath, constants.FLOWS_DIRECTORY);
  if (!existsMustBeDir(flowsFolder)) return { flows: null }; // Skip

  const files = getFiles(flowsFolder, ['.json']);

  const flows = files.map((f) => {
    const flow = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return flow;
  });

  return {
    flows,
  };
}

async function dump(context: DirectoryContext) {
  const { flows } = context.assets;

  if (!flows) return; // Skip, nothing to dump

  const flowsFolder = path.join(context.filePath, constants.FLOWS_DIRECTORY);
  fs.ensureDirSync(flowsFolder);

  flows.forEach((flow) => {
    const flowFile = path.join(flowsFolder, sanitize(`${flow.name}.json`));
    log.info(`Writing ${flowFile}`);

    dumpJSON(flowFile, flow);
  });
}

const flowsHandler: DirectoryHandler<ParsedFlows> = {
  parse,
  dump,
};

export default flowsHandler;
