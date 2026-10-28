import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';

import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Agent, findDuplicateNames } from '../../../tools/auth0/handlers/agents';

type ParsedAgents = ParsedAsset<'agents', Partial<Agent>[]>;

function parse(context: DirectoryContext): ParsedAgents {
  const agentsFolder = path.join(context.filePath, constants.AGENTS_DIRECTORY);
  if (!existsMustBeDir(agentsFolder)) return { agents: null }; // Skip

  const files = getFiles(agentsFolder, ['.json']);

  const agents = files.map((f) => ({
    ...loadJSON(f, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  }));

  return {
    agents,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { agents } = context.assets;
  if (!agents) return;

  const agentsFolder = path.join(context.filePath, constants.AGENTS_DIRECTORY);
  fs.ensureDirSync(agentsFolder);

  // Agent names are not unique; number the files of agents sharing a name so they don't
  // overwrite each other. agent_id can't be used: it is stripped unless AUTH0_EXPORT_IDENTIFIERS is set.
  const duplicateNames = new Set(findDuplicateNames(agents));
  const countByName = new Map<string, number>();

  // Remove read-only fields
  agents.forEach(({ agent_id, created_at, updated_at, ...agent }) => {
    let fileName = agent.name;
    if (duplicateNames.has(agent.name)) {
      const count = (countByName.get(agent.name) || 0) + 1;
      countByName.set(agent.name, count);
      fileName = `${agent.name}-${count}`;
    }
    const agentFile = path.join(agentsFolder, sanitize(`${fileName}.json`));
    log.info(`Writing ${agentFile}`);
    dumpJSON(agentFile, agent);
  });
}

const agentsHandler = {
  parse,
  dump,
};

export default agentsHandler;
