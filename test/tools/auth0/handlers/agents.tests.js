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
function mockClient({
  remoteAgents = [],
  remoteClients = [],
  agentsListError,
  createError,
  clientUpdateError,
} = {}) {
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
        if (createError) return Promise.reject(createError);
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
      update: (id, data) => {
        // Only the agent link may be sent
        if (Object.keys(data).join() !== 'agent_id') {
          return Promise.reject(new Error(`unexpected client update body ${JSON.stringify(data)}`));
        }
        calls.push(['clients.update', id, data.agent_id]);
        if (clientUpdateError) return Promise.reject(clientUpdateError);
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

    it('should not list clients when the tenant has no agents', async () => {
      const handler = new agents.default({
        client: pageClient({
          agents: { list: (params) => mockPagedData(params, 'agents', []) },
          clients: { list: notCalled('clients.list') },
        }),
        config,
      });

      expect(await handler.getType()).to.deep.equal([]);
    });

    it('should return null when agents are not enabled for the tenant', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), {
          statusCode: 403,
          body: { errorCode: 'feature_not_enabled' },
        }),
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

    it('should unlink clients before deleting an agent so none points at the deleted agent', async () => {
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
        expect(err.message).to.include(
          'links to client(s) that do not exist or are excluded: "Missing App"'
        );
      }
      expect(calls).to.deep.equal([]);
    });

    it('should fail when agents are configured but not enabled for the tenant', async () => {
      const { client, calls } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), {
          statusCode: 403,
          body: { errorCode: 'feature_not_enabled' },
        }),
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

    it('should not list clients when no agent configures links', async () => {
      let clientListCalls = 0;
      const auth0 = {
        agents: {
          list: (params) =>
            mockPagedData(params, 'agents', [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }]),
          update: (id, data) => Promise.resolve({ agent_id: id, ...data }),
        },
        clients: {
          list: (params) => {
            clientListCalls += 1;
            return mockPagedData(params, 'clients', []);
          },
        },
      };
      const handler = new agents.default({ client: pageClient(auth0), config });

      await handler.processChanges({ agents: [{ name: 'Agent A', metadata: { a: 1 } }] });
      await handler.dryRunChanges({ agents: [{ name: 'Agent A' }] });

      // Only getType lists clients, once, to resolve existing links
      expect(clientListCalls).to.equal(1);
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

    it('should move a client between agents with a single link call', async () => {
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
        agentsListError: Object.assign(new Error('Forbidden'), {
          statusCode: 403,
          body: { errorCode: 'feature_not_enabled' },
        }),
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

  describe('#agents deletes, removals and client filters', () => {
    const captureWarnings = async (fn) => {
      const warnings = [];
      const warnStub = sinon.stub(log, 'warn').callsFake((msg) => warnings.push(msg));
      try {
        await fn();
      } finally {
        warnStub.restore();
      }
      return warnings;
    };

    it('should delete 3 or more agents without deadlocking the request pool', async function () {
      this.timeout(5000);
      const { client, calls } = mockClient({
        remoteAgents: [
          { agent_id: 'agt_1', name: 'Old 1', metadata: {} },
          { agent_id: 'agt_2', name: 'Old 2', metadata: {} },
          { agent_id: 'agt_3', name: 'Old 3', metadata: {} },
          { agent_id: 'agt_4', name: 'Old 4', metadata: {} },
        ],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: 'agt_2' }],
      });
      const handler = new agents.default({ client, config });

      // No configured agent has a `clients` key, so nothing prefetches clients for links
      await handler.processChanges({ agents: [{ name: 'New' }] });

      expect(calls.filter(([fn]) => fn === 'agents.delete').map(([, id]) => id)).to.have.members([
        'agt_1',
        'agt_2',
        'agt_3',
        'agt_4',
      ]);
      const unlinkIndex = calls.findIndex(([fn, id]) => fn === 'clients.update' && id === 'c1');
      const deleteIndex = calls.findIndex(([fn, id]) => fn === 'agents.delete' && id === 'agt_2');
      expect(unlinkIndex).to.be.greaterThan(-1);
      expect(unlinkIndex).to.be.lessThan(deleteIndex);
    });

    it('should not unlink removed clients when AUTH0_ALLOW_DELETE is off, and warn', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      const warnings = await captureWarnings(() =>
        handler.processChanges({ agents: [{ name: 'Agent A', clients: [] }] })
      );

      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([]);
      expect(warnings.some((w) => w.includes('"App One" from agent "Agent A"'))).to.equal(true);
    });

    it('should still move clients between agents when AUTH0_ALLOW_DELETE is off', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false };
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
        ['clients.update', 'c1', AGENT_B],
      ]);
    });

    it('should warn about removals in a dry run when AUTH0_ALLOW_DELETE is off', async () => {
      config.data = { AUTH0_ALLOW_DELETE: false, AUTH0_DRY_RUN: 'preview' };
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }],
      });
      const handler = new agents.default({ client, config });

      const warnings = await captureWarnings(() =>
        handler.dryRunChanges({ agents: [{ name: 'Agent A', clients: [] }] })
      );

      expect(warnings.some((w) => w.includes('"App One" from agent "Agent A"'))).to.equal(true);
      expect(calls).to.deep.equal([]);
    });

    it('should not unlink, link or export excluded clients', async () => {
      config.data = { AUTH0_ALLOW_DELETE: true, AUTH0_EXCLUDED_CLIENTS: ['Excluded App'] };
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [
          { client_id: 'c1', name: 'Excluded App', agent_id: AGENT_A },
          { client_id: 'c2', name: 'App Two', agent_id: AGENT_A },
        ],
      });
      const handler = new agents.default({ client, config });

      expect((await handler.getType())[0].clients).to.deep.equal(['App Two']);

      await handler.processChanges({ agents: [{ name: 'Agent A', clients: [] }] });
      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([
        ['clients.update', 'c2', null],
      ]);

      try {
        await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['Excluded App'] }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('do not exist or are excluded: "Excluded App"');
      }
    });

    it('should ignore dynamic CIMD clients that share a name with a managed client', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [
          { client_id: 'managed', name: 'Shared Name' },
          {
            client_id: 'cimd',
            name: 'Shared Name',
            external_metadata_type: 'cimd',
            external_metadata_created_by: 'client',
          },
        ],
      });
      const handler = new agents.default({ client, config });

      await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['Shared Name'] }] });

      expect(calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([
        ['clients.update', 'managed', AGENT_A],
      ]);
    });

    it('should export each client name once and reject linking an ambiguous client name', async () => {
      const { client, calls } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [
          { client_id: 'c1', name: 'Dup', agent_id: AGENT_A },
          { client_id: 'c2', name: 'Dup', agent_id: AGENT_A },
        ],
      });
      const handler = new agents.default({ client, config });

      expect((await handler.getType())[0].clients).to.deep.equal(['Dup']);

      try {
        await handler.processChanges({ agents: [{ name: 'Agent A', clients: ['Dup'] }] });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('shared by several clients on the tenant: "Dup"');
      }
      expect(calls).to.deep.equal([]);
    });

    it('should report a dry-run update when a metadata key is removed', async () => {
      config.data = { AUTH0_DRY_RUN: 'preview' };
      const { client } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: { a: 1, b: 2 } }],
      });
      const handler = new agents.default({ client, config });

      const changes = await handler.dryRunChanges({
        agents: [{ name: 'Agent A', metadata: { a: 1 } }],
      });

      expect(changes.update.map((a) => a.name)).to.deep.equal(['Agent A']);
    });

    it('should treat an empty agents list as a no-op on a tenant without the feature', async () => {
      const notEnabled = Object.assign(new Error('Forbidden'), {
        statusCode: 403,
        body: { errorCode: 'feature_not_enabled' },
      });
      const insufficientScope = Object.assign(
        new Error('Insufficient scope, expected any of: read:agents'),
        { statusCode: 403, body: { errorCode: 'insufficient_scope' } }
      );

      for (const agentsListError of [notEnabled, insufficientScope]) {
        const { client, calls } = mockClient({ agentsListError });
        await new agents.default({ client, config }).processChanges({ agents: [] });
        const changes = await new agents.default({ client, config }).dryRunChanges({ agents: [] });
        expect(changes).to.deep.equal({ del: [], create: [], conflicts: [], update: [] });
        expect(calls).to.deep.equal([]);
      }
    });

    for (const statusCode of [404, 501]) {
      it(`should skip agents without failing the export when /agents returns ${statusCode}`, async () => {
        const { client } = mockClient({
          agentsListError: Object.assign(new Error('Not available'), { statusCode }),
        });
        const handler = new agents.default({ client, config });

        expect(await handler.load()).to.deep.equal({ agents: null });
      });
    }

    it('should apply a removed metadata key when the preview is applied (--dry-run --apply)', async () => {
      for (const dryRun of [undefined, true, 'preview']) {
        config.data = { AUTH0_DRY_RUN: dryRun };
        const { client, calls } = mockClient({
          remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: { a: 1, b: 2 } }],
        });
        const handler = new agents.default({ client, config });

        await handler.processChanges({ agents: [{ name: 'Agent A', metadata: { a: 1 } }] });

        expect(calls, `AUTH0_DRY_RUN=${dryRun}`).to.deep.equal([
          ['agents.update', AGENT_A, { name: 'Agent A', metadata: { a: 1 } }],
        ]);
      }
    });

    it('should rethrow 403 errors that are not a disabled feature', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      });
      const handler = new agents.default({ client, config });

      try {
        await handler.getType();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Forbidden');
      }
    });

    it('should not count clients the clients handler skips as created by the import', async () => {
      for (const data of [
        { AUTH0_EXCLUDED_CLIENTS: ['New App'] },
        { AUTH0_EXCLUDED: ['clients'] },
        { AUTH0_INCLUDED_ONLY: ['agents'] },
      ]) {
        config.data = { ...data, AUTH0_DRY_RUN: 'preview' };
        const { client } = mockClient();
        const handler = new agents.default({ client, config });

        try {
          await handler.dryRunChanges({
            clients: [{ name: 'New App' }],
            agents: [{ name: 'Agent A', clients: ['New App'] }],
          });
          expect.fail(`should have thrown for ${JSON.stringify(data)}`);
        } catch (err) {
          expect(err.message).to.include('"New App"');
        }
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

    it('should strip agent_id from client create and update payloads and warn', async () => {
      const writes = [];
      const auth0 = {
        clients: {
          create: (data) => {
            writes.push(['create', data]);
            return Promise.resolve({ data });
          },
          update: (id, data) => {
            writes.push(['update', id, data]);
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'c1', name: 'Old App' }]),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
      };
      const handler = new clients.default({ client: pageClient(auth0), config });

      const warnings = [];
      const warnStub = sinon.stub(log, 'warn').callsFake((msg) => warnings.push(msg));
      try {
        await handler.processChanges({
          clients: [
            { name: 'Old App', description: 'updated', agent_id: AGENT_A },
            { name: 'New App', agent_id: AGENT_B },
          ],
        });
      } finally {
        warnStub.restore();
      }

      expect(writes.map(([op]) => op).sort()).to.deep.equal(['create', 'update']);
      writes.forEach((write) => expect(write[write.length - 1]).to.not.have.property('agent_id'));
      expect(
        warnings.some((w) => w.includes('Ignoring agent_id on client(s) "Old App", "New App"'))
      ).to.equal(true);
    });
  });

  describe('#agents client lifecycle and safety', () => {
    const captureWarnings = async (fn) => {
      const warnings = [];
      const warnStub = sinon.stub(log, 'warn').callsFake((msg) => warnings.push(msg));
      try {
        await fn();
      } finally {
        warnStub.restore();
      }
      return warnings;
    };

    it('should fail the dry run like the import when a linked client is deleted by the same import', async () => {
      const assets = {
        clients: [{ name: 'Kept App' }],
        agents: [{ name: 'Agent A', clients: ['Removed App'] }],
      };
      const remoteClients = [
        { client_id: 'c1', name: 'Removed App' },
        { client_id: 'c2', name: 'Kept App' },
      ];

      config.data = { AUTH0_ALLOW_DELETE: true, AUTH0_DRY_RUN: 'preview' };
      try {
        await new agents.default({
          client: mockClient({ remoteClients }).client,
          config,
        }).dryRunChanges(assets);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('"Removed App"');
      }

      // Without AUTH0_ALLOW_DELETE the clients handler keeps the client, so the preview passes
      config.data = { AUTH0_ALLOW_DELETE: false, AUTH0_DRY_RUN: 'preview' };
      const changes = await new agents.default({
        client: mockClient({ remoteClients }).client,
        config,
      }).dryRunChanges(assets);
      expect(changes.create.map((a) => a.name)).to.deep.equal(['Agent A']);
    });

    it('should never link, unlink or delete-unlink the Deploy CLI client', async () => {
      const deployClient = { client_id: 'deployer', name: 'Deploy CLI' };

      config.data = { AUTH0_ALLOW_DELETE: true, AUTH0_CLIENT_ID: 'deployer' };
      // Removal from an agent
      let mock = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ ...deployClient, agent_id: AGENT_A }],
      });
      let warnings = await captureWarnings(() =>
        new agents.default({ client: mock.client, config }).processChanges({
          agents: [{ name: 'Agent A', clients: [] }],
        })
      );
      expect(mock.calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([]);
      expect(
        warnings.some((w) => w.includes('Skipping agent link changes for client(s) "Deploy CLI"'))
      ).to.be.true;

      // Link to an agent
      mock = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [deployClient],
      });
      await new agents.default({ client: mock.client, config }).processChanges({
        agents: [{ name: 'Agent A', clients: ['Deploy CLI'] }],
      });
      expect(mock.calls.filter(([fn]) => fn === 'clients.update')).to.deep.equal([]);

      // Deleting the agent it is linked to still deletes the agent
      mock = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ ...deployClient, agent_id: AGENT_A }],
      });
      await new agents.default({ client: mock.client, config }).processChanges({ agents: [] });
      expect(mock.calls).to.deep.equal([['agents.delete', AGENT_A]]);
    });

    it('should not count third-party clients as created when AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS is set', async () => {
      config.data = { AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS: true, AUTH0_DRY_RUN: 'preview' };

      try {
        await new agents.default({ client: mockClient().client, config }).dryRunChanges({
          clients: [{ name: 'New App' }],
          agents: [{ name: 'Agent A', clients: ['New App'] }],
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('"New App"');
      }

      const changes = await new agents.default({
        client: mockClient().client,
        config,
      }).dryRunChanges({
        clients: [{ name: 'New App', is_first_party: true }],
        agents: [{ name: 'Agent A', clients: ['New App'] }],
      });
      expect(changes.create.map((a) => a.name)).to.deep.equal(['Agent A']);
    });

    it('should surface a failed agent create', async () => {
      const { client } = mockClient({ createError: new Error('create failed') });

      try {
        await new agents.default({ client, config }).processChanges({
          agents: [{ name: 'Agent A' }],
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Problem creating agents');
        expect(err.message).to.include('create failed');
      }
    });

    it('should surface a failed link and tell the user to re-run the import', async () => {
      const { client } = mockClient({
        remoteAgents: [{ agent_id: AGENT_A, name: 'Agent A', metadata: {} }],
        remoteClients: [{ client_id: 'c1', name: 'App One' }],
        clientUpdateError: Object.assign(new Error('link failed'), { statusCode: 400 }),
      });

      try {
        await new agents.default({ client, config }).processChanges({
          agents: [{ name: 'Agent A', clients: ['App One'] }],
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Problem linking client "App One" to agent "Agent A"');
        expect(err.message).to.include('Re-run the import to retry');
      }
    });

    it('should make no link, create or delete calls when importing the same config again', async () => {
      const remoteAgents = [{ agent_id: AGENT_A, name: 'Agent A', metadata: { team: 'x' } }];
      const remoteClients = [{ client_id: 'c1', name: 'App One', agent_id: AGENT_A }];
      const assets = () => ({
        agents: [{ name: 'Agent A', clients: ['App One'], metadata: { team: 'x' } }],
      });

      for (let run = 0; run < 2; run += 1) {
        const { client, calls } = mockClient({ remoteAgents, remoteClients });
        await new agents.default({ client, config }).processChanges(assets());
        // Matched agents are always PATCHed by the default handler; nothing else may happen
        expect(calls.map(([fn]) => fn)).to.deep.equal(['agents.update']);
      }
    });

    it('should name the reason when agents are configured but the API is not available', async () => {
      const { client } = mockClient({
        agentsListError: Object.assign(new Error('Not Found'), { statusCode: 404 }),
      });

      try {
        await new agents.default({ client, config }).processChanges({
          agents: [{ name: 'Agent A' }],
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.equal(
          'Agents are configured but the Agents API is not available on this tenant (HTTP 404).'
        );
      }
    });
  });
});
