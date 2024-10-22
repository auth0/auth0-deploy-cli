import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Flow } from '../../../tools/auth0/handlers/flows';

type ParsedFlows = ParsedAsset<'flows', Flow[]>;

async function parse(context: YAMLContext): Promise<ParsedFlows> {
  const { flows } = context.assets;

  if (!flows) return { flows: null };

  return {
    flows: [
      ...flows.map((flow) => ({
        ...flow,
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedFlows> {
  let { flows } = context.assets;

  if (!flows) {
    return { flows: null };
  }

  const pagesFolder = path.join(context.basePath, 'flows');
  fs.ensureDirSync(pagesFolder);

  flows = flows.map((flow) => {
    if (flow.name === undefined) {
      return flow;
    }

    const jsonFile = path.join(pagesFolder, `${flow.name}.json`);
    log.info(`Writing ${jsonFile}`);
    fs.writeFileSync(jsonFile, flow.name);
    return {
      ...flow,
      html: `./flows/${flow.name}.json`,
    };
  });

  return { flows };
}

const pagesHandler: YAMLHandler<ParsedFlows> = {
  parse,
  dump,
};

export default pagesHandler;
