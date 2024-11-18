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

  // Check if there is any duplicate flow name
  const flowNameSet = new Set();
  const duplicateFlowNames = new Set();

  flows.forEach((flow) => {
    if (flowNameSet.has(flow.name)) {
      duplicateFlowNames.add(flow.name);
    } else {
      flowNameSet.add(flow.name);
    }
  });

  if (duplicateFlowNames.size > 0) {
    const duplicateNamesArray = Array.from(duplicateFlowNames).join(', ');
    log.error(
      `Duplicate flow names found: [${duplicateNamesArray}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate flow names found: ${duplicateNamesArray}`);
  }

  flows.forEach((flow) => {
    if (flow.name === undefined) {
      return;
    }
    const flowFile = path.join(flowsFolder, sanitize(`${flow.name}.json`));
    log.info(`Writing ${flowFile}`);

    const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'submitted_at', 'embedded_at'];
    removeKeysFromOutput.forEach((key) => {
      if (key in flow) {
        delete flow[key];
      }
    });

    dumpJSON(flowFile, flow);
  });
}

const flowsHandler: DirectoryHandler<ParsedFlows> = {
  parse,
  dump,
};

export default flowsHandler;
