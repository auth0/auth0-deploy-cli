import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/agents';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context agents', () => {
  it('should process agents', async () => {
    const dir = path.join(testDataDir, 'yaml', 'agents');
    cleanThenMkdir(dir);

    const yaml = `
    agents:
      - name: "Support Agent"
        clients: @@AGENT_CLIENTS@@
        external_agent_id: "##EXTERNAL_ID##"
        metadata:
          team: support
    `;
    const yamlFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
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
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.agents = [
      {
        agent_id: 'agt_72jbvv7LfRKYp59gtRLtkn',
        name: 'Support Agent',
        clients: ['Support M2M'],
        external_agent_id: 'ext-support',
        metadata: { team: 'support' },
        created_at: '2026-10-21T00:00:00.000Z',
        updated_at: '2026-10-21T00:00:00.000Z',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      agents: [
        {
          name: 'Support Agent',
          clients: ['Support M2M'],
          external_agent_id: 'ext-support',
          metadata: { team: 'support' },
        },
      ],
    });
  });

  it('should not dump agents when they are not enabled for the tenant', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.agents = null;

    expect(await handler.dump(context)).to.deep.equal({ agents: null });
  });
});
