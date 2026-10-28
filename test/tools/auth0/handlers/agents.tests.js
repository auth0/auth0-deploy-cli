const Ajv = require('ajv');
const { expect } = require('chai');
const sinon = require('sinon');
const log = require('../../../../src/logger').default;
const agents = require('../../../../src/tools/auth0/handlers/agents');
const clients = require('../../../../src/tools/auth0/handlers/clients');
const { mockPagedData } = require('../../../utils');
const pageClient = require('../../../../src/tools/auth0/client').default;

const AGENT_A = 'agt_72jbvv7LfRKYp59gtRLtkn';
const AGENT_B = 'agt_8RkL2mNpQ3sT4uV5wX6yZa';
const AGENT_NEW = 'agt_9AbCdEfGhJkLmNpQrStUvW';

const notCalled = (name) => () => {
  throw new Error(`${name} should not be called`);
};

// Builds a mock client that records every write in `calls`
function mockClient({ remoteAgents = [], remoteClients = [], agentsListError } = {}) {
  const calls = [];
  let agentsState = [...remoteAgents];

  const auth0 = {
    agents: {
      list: (params) => {
        if (agentsListError) return Promise.reject(agentsListError);
        return mockPagedData(params, 'agents', agentsState);
      },
      create: (data) => {
        calls.push(['agents.create', data]);
        const created = { ...data, agent_id: AGENT_NEW };
        agentsState = [...agentsState, created];
        return Promise.resolve(created);
      },
      update: (id, data) => {
        calls.push(['agents.update', id, data]);
        return Promise.resolve({ agent_id: id, ...data });
      },
      delete: (id) => {
        calls.push(['agents.delete', id]);
        agentsState = agentsState.filter((a) => a.agent_id !== id);
        return Promise.resolve();
      },
    },
    clients: {
      list: (params) => mockPagedData(params, 'clients', remoteClients),
      update: (id, data, options) => {
        calls.push(['clients.update', id, options.additionalBodyParameters.agent_id]);
        return Promise.resolve({ client_id: id });
      },
    },
  };

  return { client: pageClient(auth0), calls };
}

describe('#agents handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  beforeEach(() => {
    config.data = {
      AUTH0_ALLOW_DELETE: true,
    };
  });

  describe('#agents schema', () => {
    const ajv = new Ajv({ useDefaults: true, nullable: true });

    it('should pass validation with all fields', () => {
      const valid = ajv.validate(agents.schema, [
        {
          name: 'Support Agent',
          clients: ['Support Agent M2M'],
          external_agent_id: 'ext-123',
          metadata: { team: 'support' },
        },
      ]);
      expect(valid).to.equal(true);
    });

    it('should fail validation without name', () => {
      expect(ajv.validate(agents.schema, [{ clients: [] }])).to.equal(false);
    });
  });

  describe('#agents validate', () => {
    it('should not allow a client to be linked to two agents', async () => {
      const handler = new agents.default({ client: {}, config });

      try {
        await handler.validate({
          agents: [
            { name: 'Agent A', clients: ['Shared M2M'] },
            { name: 'Agent B', clients: ['Shared M2M'] },
          ],
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Client "Shared M2M" is linked to both agent "Agent A"');
      }
    });

    it('should not allow duplicate agent names', async () => {
      const handler = new agents.default({ client: {}, config });

      try {
        await handler.validate({ agents: [{ name: 'Agent A' }, { name: 'Agent A' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Names must be unique');
      }
    });
  });

  describe('#agents getType', () => {
    it('should represent linked clients by name', async () => {
      const { client } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [
          { client_id: 'c1', name: 'App One', agent_id: AGENT_A },
          { client_id: 'c2', name: 'App Two' },
        ],
      });
      const handler = new agents.default({ client, config });

      const data = await handler.getType();
      expect(data).to.deep.equal([
        { agent_id: AGENT_A, name: 'Agent A', metadata: {}, clients: ['App One'] },
      ]);
    });

    it('should return null when agents are not enabled for the tenant', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      });
      const handler = new agents.default({ client, config });

      expect(await handler.getType()).to.equal(null);
    });

    it('should rethrow insufficient scope errors', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(
          new Error('Insufficient scope, expected any of: read:agents'),
          { statusCode: 403 }
        ),
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.getType();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Insufficient scope');
      }
    });
  });

  describe('#agents process', () => {
    it('should create an agent and link its client', async () => {
      const { client, calls } = mockClient({
        remoteClients: [{ client_id: 'c1', name: 'App One' }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({
        agents: [
          {
            name: 'Agent A',
            clients: ['App One'],
            external_agent_id: 'ext-1',
            metadata: { team: 'support' },
          },
        ],
      });

      expect(calls).to.deep.equal([
        [
          'agents.create',
          { name: 'Agent A', external_agent_id: 'ext-1', metadata: { team: 'support' } },
        ],
        ['clients.update', 'c1', AGENT_NEW],
      ]);
    });

    it('should update an agent without immutable or link fields', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', external_agent_id: 'ext-1', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({
        agents: [{ name: 'Agent A', external_agent_id: 'ext-1', metadata: { team: 'x' } }],
      });

      expect(calls).to.deep.equal([
        ['agents.update', AGENT_A, { name: 'Agent A', metadata: { team: 'x' } }],
      ]);
    });

    it('should unlink removed clients and link new ones', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [
          { client_id: 'c1', name: 'App One', agent_id: AGENT_A },
          { client_id: 'c2', name: 'App Two' },
        ],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['App Two'] }] });

      const linkCalls = calls.filter(([fn]) => fn === 'clients.update');
      expect(linkCalls).to.deep.equal([
        ['clients.update', 'c1', null],
        ['clients.update', 'c2', AGENT_A],
      ]);
    });

    it('should move a client linked to another agent without unlinking it first', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', metadata: {} },
          { agent_id: AGENT_B, name: 'Agent B', metadata: {} },
        ],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({
        agents: [{ name: 'Agent A' }, { name: 'Agent B', clients: ['App One'] }],
      });

      const linkCalls = calls.filter(([fn]) => fn === 'clients.update');
      expect(linkCalls).to.deep.equal([['clients.update', 'c1', AGENT_B]]);
    });

    it('should fail without writing when a configured name matches several tenant agents', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'my-agent', metadata: {} },
          { agent_id: AGENT_B, name: 'my-agent', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.processChanges({ agents: [{ name: 'my-agent', metadata: { a: 1 } }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Cannot match agent(s) "my-agent"');
      }
      expect(calls).to.deep.equal([]);
    });

    it('should manage other agents when the tenant has duplicate names that are not configured', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'my-agent', metadata: {} },
          { agent_id: AGENT_B, name: 'my-agent', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [{ name: 'Agent C' }] });

      expect(calls).to.deep.equal([['agents.create', { name: 'Agent C' }]]);
    });

    it('should not touch links when clients is omitted', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [{ name: 'Agent A' }] });

      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([]);
    });

    it('should unlink clients before deleting an agent so they are not cascade-deleted', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [] });

      expect(calls).to.deep.equal([
        ['clients.update', 'c1', null],
        ['agents.delete', AGENT_A],
      ]);
    });

    it('should not delete or unlink when AUTH0_ALLOW_DELETE is false', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [] });

      expect(calls).to.deep.equal([]);
    });

    it('should fail without writing when external_agent_id changes', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', external_agent_id: 'ext-1', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.processChanges({ agents: [{ name: 'Agent A', external_agent_id: 'ext-2' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Cannot change external_agent_id of agent "Agent A"');
      }
      expect(calls).to.deep.equal([]);
    });

    it('should fail without writing when a linked client does not exist', async () => {
      const { client, calls } = mockClient();
      const handler = new agents.default({ client, config });

      try {
        await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['Missing App'] }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('links to client(s) that do not exist: "Missing App"');
      }
      expect(calls).to.deep.equal([]);
    });

    it('should fail when agents are configured but not enabled for the tenant', async () => {
      const { client, calls } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.processChanges({ agents: [{ name: 'Agent A' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('agents_as_principals_limited_ea');
      }
      expect(calls).to.deep.equal([]);
    });

    it('should do nothing when agents are not configured', async () => {
      const handler = new agents.default({
        client: pageClient({ agents: { list: notCalled('agents.list') } }),
        config,
      });

      await handler.processChanges({});
    });
  });

  describe('#agents dry run', () => {
    beforeEach(() => {
      config.data = { AUTH0_ALLOW_DELETE: true, AUTH0_DRY_RUN: 'preview' };
    });

    it('should report create, update and delete without writing', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', metadata: {} },
          { agent_id: AGENT_B, name: 'Agent B', metadata: {} },
        ],
        remoteClients: [
          { client_id: 'c1', name: 'App One', agent_id: AGENT_B },
          { client_id: 'c2', name: 'App Two' },
        ],
      });
      const handler = new agents.default({ client, config });

      const changes = await handler.dryRunChanges({
        agents: [{ name: 'Agent A', clients: ['App Two'] }, { name: 'Agent C' }],
      });

      expect(changes.create.map((a) => a.name)).to.deep.equal(['Agent C']);
      expect(changes.update.map((a) => a.name)).to.deep.equal(['Agent A']);
      expect(changes.del.map((a) => a.name)).to.deep.equal(['Agent B']);
      expect(calls).to.deep.equal([]);
    });

    it('should report no changes when links already match', async () => {
      const { client } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      const changes = await handler.dryRunChanges({
        agents: [{ name: 'Agent A', clients: ['App One'] }],
      });

      expect(changes.update).to.deep.equal([]);
      expect(changes.create).to.deep.equal([]);
    });

    it('should accept clients created earlier in the same import', async () => {
      const { client, calls } = mockClient();
      const handler = new agents.default({ client, config });

      const changes = await handler.dryRunChanges({
        clients: [{ name: 'New App' }],
        agents: [{ name: 'Agent A', clients: ['New App'] }],
      });

      expect(changes.create.map((a) => a.name)).to.deep.equal(['Agent A']);
      expect(calls).to.deep.equal([]);
    });

    it('should fail like a real import when a linked client does not exist', async () => {
      const { client } = mockClient();
      const handler = new agents.default({ client, config });

      try {
        await handler.dryRunChanges({ agents: [{ name: 'Agent A', clients: ['Missing App'] }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('"Missing App"');
      }
    });

    it('should fail like a real import when external_agent_id changes', async () => {
      const { client } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', external_agent_id: 'ext-1', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.dryRunChanges({ agents: [{ name: 'Agent A', external_agent_id: 'ext-2' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Cannot change external_agent_id');
      }
    });

    it('should apply link changes when the preview is applied (--dry-run --apply)', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One' }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['App One'] }] });

      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([
        ['clients.update', 'c1', AGENT_A],
      ]);
    });

    it('should unlink a client only once when it moves between agents', async () => {
      config.data = { AUTH0_ALLOW_DELETE: true };
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'Agent A', metadata: {} },
          { agent_id: AGENT_B, name: 'Agent B', metadata: {} },
        ],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({
        agents: [
          { name: 'Agent A', clients: [] },
          { name: 'Agent B', clients: ['App One'] },
        ],
      });

      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([
        ['clients.update', 'c1', null],
        ['clients.update', 'c1', AGENT_B],
      ]);
    });

    it('should fail like a real import when a configured name matches several tenant agents', async () => {
      const { client } = mockClient({
        remoteAgents: [
          { agent_id: AGENT_A, name: 'my-agent', metadata: {} },
          { agent_id: AGENT_B, name: 'my-agent', metadata: {} },
        ],
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.dryRunChanges({ agents: [{ name: 'my-agent' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Cannot match agent(s) "my-agent"');
      }
    });

    it('should only warn about unlinking on delete when deletes are allowed', async () => {
      const warnings = [];
      const warnStub = sinon.stub(log, 'warn').callsFake((msg) => warnings.push(msg));
      try {
        for (const allowDelete of [false, true]) {
          config.data = { AUTH0_ALLOW_DELETE: allowDelete, AUTH0_DRY_RUN: 'preview' };
          const { client } = mockClient({
            remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
            remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
          });
          await new agents.default({ client, config }).dryRunChanges({ agents: [] });
        }
      } finally {
        warnStub.restore();
      }

      const unlinkWarnings = warnings.filter((w) => w.includes('will first unlink'));
      expect(unlinkWarnings).to.deep.equal([
        'Deleting agent "Agent A" will first unlink client(s) "App One". The clients are kept.',
      ]);
    });

    it('should fail like a real import when agents are not enabled', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.dryRunChanges({ agents: [{ name: 'Agent A' }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('agents_as_principals_limited_ea');
      }
    });
  });

  describe('#clients agent_id handling', () => {
    it('should not export agent_id on clients', async () => {
      const { client } = mockClient({
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new clients.default({ client, config });

      const data = await handler.getType();
      expect(data[0]).to.not.have.property('agent_id');
    });
  });
});
