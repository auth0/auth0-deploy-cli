import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';

import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Agent } from '../../../tools/auth0/handlers/agents';

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

  // Agent names are not unique, and different names can sanitize to the same file name
  // (e.g. "a/b" and "a-b"). Number the files that would collide so no agent overwrites another,
  // without taking a file name that another agent uses as-is (e.g. an agent named "my-agent-1").
  // agent_id can't be used in file names: it is removed from the exported files.
  const naturalFiles = agents.map((agent) => sanitize(`${agent.name}.json`));
  const filesCount = new Map<string, number>();
  naturalFiles.forEach((file) => filesCount.set(file, (filesCount.get(file) || 0) + 1));

  const writtenFiles = new Set<string>();
  // Remove read-only fields
  agents.forEach(({ agent_id, created_at, updated_at, ...agent }, index) => {
    let fileName = naturalFiles[index];
    if (filesCount.get(fileName) !== 1) {
      for (let n = 1; ; n += 1) {
        const candidate = sanitize(`${agent.name}-${n}.json`);
        if (!writtenFiles.has(candidate) && !filesCount.has(candidate)) {
          fileName = candidate;
          break;
        }
      }
    }
    writtenFiles.add(fileName);

    const agentFile = path.join(agentsFolder, fileName);
    log.info(`Writing ${agentFile}`);
    dumpJSON(agentFile, agent);
  });

  // Remove files of agents no longer on the tenant, otherwise the next import recreates them.
  // Only `.json` files are read back by `parse`, so nothing else in the folder is touched.
  getFiles(agentsFolder, ['.json'])
    .filter((file) => !writtenFiles.has(path.basename(file)))
    .forEach((file) => {
      log.info(`Removing ${file}`);
      fs.removeSync(file);
    });
}

const agentsHandler = {
  parse,
  dump,
};

export default agentsHandler;
