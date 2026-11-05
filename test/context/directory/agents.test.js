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
    // File names never use agent_id, which is not written to the exported files
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

  it('should not overwrite files when numbered or sanitized names collide', async () => {
    const dir = path.join(testDataDir, 'directory', 'agentsFileCollisions');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.agents = [
      { name: 'my-agent', metadata: { n: 1 } },
      { name: 'my-agent', metadata: { n: 2 } },
      { name: 'my-agent-1', metadata: { n: 3 } },
      { name: 'a/b', metadata: { n: 4 } },
      { name: 'a-b', metadata: { n: 5 } },
    ];

    await handler.dump(context);

    const agentsDir = path.join(dir, constants.AGENTS_DIRECTORY);
    const files = fs.readdirSync(agentsDir).sort();
    expect(files).to.have.length(5);
    expect(loadJSON(path.join(agentsDir, 'my-agent-1.json'))).to.deep.equal({
      name: 'my-agent-1',
      metadata: { n: 3 },
    });
    const written = files.map((f) => loadJSON(path.join(agentsDir, f)).metadata.n).sort();
    expect(written).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('should remove files of agents no longer on the tenant', async () => {
    const dir = path.join(testDataDir, 'directory', 'agentsStaleFiles');
    cleanThenMkdir(dir);
    const agentsDir = path.join(dir, constants.AGENTS_DIRECTORY);
    fs.ensureDirSync(agentsDir);
    fs.writeFileSync(path.join(agentsDir, 'Deleted Agent.json'), '{"name":"Deleted Agent"}');
    fs.writeFileSync(path.join(agentsDir, 'README.md'), 'notes');

    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.agents = [{ name: 'Kept Agent', metadata: {} }];

    await handler.dump(context);

    expect(fs.readdirSync(agentsDir).sort()).to.deep.equal(['Kept Agent.json', 'README.md']);
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
