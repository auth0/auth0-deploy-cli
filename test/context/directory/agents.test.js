import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/agents';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context agents', () => {
  it('should process agents', async () => {
    const files = {
      [constants.AGENTS_DIRECTORY]: {
        'Support Agent.json': `{
          "name": "Support Agent",
          "clients": @@AGENT_CLIENTS@@,
          "external_agent_id": "##EXTERNAL_ID##",
          "metadata": { "team": "support" }
        }`,
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'agents1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        AGENT_CLIENTS: ['Support M2M'],
        EXTERNAL_ID: 'ext-support',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.agents).to.deep.equal([
      {
        name: 'Support Agent',
        clients: ['Support M2M'],
        external_agent_id: 'ext-support',
        metadata: { team: 'support' },
      },
    ]);
  });

  it('should dump agents without read-only fields', async () => {
    const dir = path.join(testDataDir, 'directory', 'agentsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.agents = [
      {
        agent_id: 'agt_72jbvv7LfRKYp59gtRLtkn',
        name: 'Support Agent',
        clients: [],
        metadata: {},
        created_at: '2026-10-21T00:00:00.000Z',
        updated_at: '2026-10-21T00:00:00.000Z',
      },
    ];

    await handler.dump(context);

    const agentFile = path.join(dir, constants.AGENTS_DIRECTORY, 'Support Agent.json');
    expect(loadJSON(agentFile)).to.deep.equal({
      name: 'Support Agent',
      clients: [],
      metadata: {},
    });
  });

  it('should write a separate file for each agent sharing a name', async () => {
    const dir = path.join(testDataDir, 'directory', 'agentsDuplicateNames');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    // agent_id is already stripped by export unless AUTH0_EXPORT_IDENTIFIERS is set
    context.assets.agents = [
      { name: 'my-agent', metadata: { n: 1 } },
      { name: 'my-agent', metadata: { n: 2 } },
      { name: 'other-agent', metadata: {} },
    ];

    await handler.dump(context);

    const agentsDir = path.join(dir, constants.AGENTS_DIRECTORY);
    expect(fs.readdirSync(agentsDir).sort()).to.deep.equal([
      'my-agent-1.json',
      'my-agent-2.json',
      'other-agent.json',
    ]);
    expect(loadJSON(path.join(agentsDir, 'my-agent-2.json'))).to.deep.equal({
      name: 'my-agent',
      metadata: { n: 2 },
    });
  });

  it('should not create the agents folder when agents are not enabled', async () => {
    const dir = path.join(testDataDir, 'directory', 'agentsDisabled');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.agents = null;

    await handler.dump(context);

    expect(fs.existsSync(path.join(dir, constants.AGENTS_DIRECTORY))).to.equal(false);
  });
});
