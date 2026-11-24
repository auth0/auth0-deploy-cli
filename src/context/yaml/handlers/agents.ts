import YAMLContext from '..';
import { Agent } from '../../../tools/auth0/handlers/agents';
import { ParsedAsset } from '../../../types';

type ParsedAgents = ParsedAsset<'agents', Partial<Agent>[]>;

async function parse(context: YAMLContext): Promise<ParsedAgents> {
  const { agents } = context.assets;

  if (!agents) return { agents: null };

  return {
    agents,
  };
}

async function dump(context: YAMLContext): Promise<ParsedAgents> {
  let { agents } = context.assets;
  if (!agents) return { agents: null };

  // Remove read-only fields
  agents = agents.map(({ agent_id, created_at, updated_at, ...agent }) => agent);

  return {
    agents,
  };
}

const agentsHandler = {
  parse,
  dump,
};

export default agentsHandler;
