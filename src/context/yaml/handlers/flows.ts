import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Flow } from '../../../tools/auth0/handlers/flows';
import { loadJSON, sanitize } from '../../../utils';
import { constants } from '../../../tools';

type ParsedFlows = ParsedAsset<'flows', Flow[]>;

async function parse(context: YAMLContext): Promise<ParsedFlows> {
  const { flows } = context.assets;

  if (!flows) return { flows: null };

  const parsedFlows = flows.map((flow: Flow) => {
    const flowFile = path.join(context.basePath, flow.body);

    const parsedFlowBody = loadJSON(flowFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });

    // Remove the body from the form object
    delete parsedFlowBody.body;

    return {
      name: flow.name,
      ...parsedFlowBody,
    };
  });

  return {
    flows: [...parsedFlows],
  };
}

async function dump(context: YAMLContext): Promise<ParsedFlows> {
  let { flows } = context.assets;

  if (!flows) {
    return { flows: null };
  }

  const pagesFolder = path.join(context.basePath, constants.FLOWS_DIRECTORY);
  fs.ensureDirSync(pagesFolder);

  // Check if there is any duplicate flow name
  const flowNames = flows.map((flow) => flow.name);
  const duplicateFlowNames = flowNames.filter((name, index) => flowNames.indexOf(name) !== index);

  if (duplicateFlowNames.length > 0) {
    log.error(
      `Duplicate form names found: [${duplicateFlowNames.join(
        ', '
      )}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate flow names found: ${duplicateFlowNames.join(', ')}`);
  }

  flows = flows.map((flow) => {
    if (flow.name === undefined) {
      return flow;
    }

    const flowName = sanitize(flow.name);

    const jsonFile = path.join(pagesFolder, `${flowName}.json`);
    log.info(`Writing ${jsonFile}`);

    const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'submitted_at', 'embedded_at'];
    removeKeysFromOutput.forEach((key) => {
      if (key in flow) {
        delete flow[key];
      }
    });

    const jsonBody = JSON.stringify(flow, null, 2);
    fs.writeFileSync(jsonFile, jsonBody);

    return {
      name: flow.name,
      body: `./flows/${flowName}.json`,
    };
  });

  return { flows };
}

const pagesHandler: YAMLHandler<ParsedFlows> = {
  parse,
  dump,
};

export default pagesHandler;
