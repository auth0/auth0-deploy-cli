const Ajv = require('ajv');
const { expect } = require('chai');
const sinon = require('sinon');
const log = require('../../../../src/logger').default;
const portals = require('../../../../src/tools/auth0/handlers/portals');
const pageClient = require('../../../../src/tools/auth0/client').default;
const { dryRunFormatAssets } = require('../../../../src/tools/calculateDryRunChanges');
const { mockPagedData } = require('../../../utils');

const PORTAL_A = 'up_8RkL2mNpQ3sT4uV5wX6yZa';
const PORTAL_B = 'up_72jbvv7LfRKYp59gtRLtkn';
const PORTAL_NEW = 'up_9AbCdEfGhJkLmNpQrStUvW';

const TS = { created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-02T00:00:00.000Z' };
const CLIENT = { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' };

const portalA = () => ({
  id: PORTAL_A,
  slug: 'support',
  name: 'Support Portal',
  client: { ...CLIENT },
  navigation: { sidebar: { components: [] } },
  pages: { default: 'home', standard: [{ title: 'Home', slug: 'home' }] },
  custom_code: { head: '<meta name="x" content="y">' },
  ...TS,
});
// What an export writes: no id or timestamps
const exportedA = (overrides = {}) => {
  const { id, created_at, updated_at, ...rest } = portalA();
  return { ...rest, ...overrides };
};
const portalB = () => ({
  id: PORTAL_B,
  slug: 'partners',
  name: 'Partners',
  client: { ...CLIENT },
  ...TS,
});

// Resolves with the error a call rejects with; fails the test if it does not reject
const rejection = async (fn) => {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  return expect.fail('should have thrown');
};

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Builds a mock client that records every call in `calls`
function mockClient({
  remote = [],
  remoteClients = [],
  remoteForms = [],
  listError,
  getError,
  createError,
} = {}) {
  const calls = [];
  const toSummary = ({ id, slug, name, created_at, updated_at }) => ({
    id,
    slug,
    name,
    created_at,
    updated_at,
  });

  const auth0 = {
    forms: {
      list: (params) => {
        calls.push(['forms.list']);
        return mockPagedData(params, 'forms', remoteForms);
      },
    },
    clients: {
      list: (params) => {
        calls.push(['clients.list']);
        return mockPagedData(params, 'clients', remoteClients);
      },
    },
    portals: {
      list: () => {
        calls.push(['portals.list']);
        if (listError) return Promise.reject(listError);
        return Promise.resolve({ portals: remote.map(toSummary) });
      },
      get: (id) => {
        calls.push(['portals.get', id]);
        if (getError) return Promise.reject(getError);
        const found = remote.find((p) => p.id === id);
        // The API never returns the secret
        return Promise.resolve(found ? JSON.parse(JSON.stringify(found)) : undefined);
      },
      create: (data) => {
        calls.push(['portals.create', data]);
        if (createError) return Promise.reject(createError);
        return Promise.resolve({ id: PORTAL_NEW, ...data, client: CLIENT });
      },
      update: (id, data) => {
        calls.push(['portals.update', id, data]);
        return Promise.resolve({ id, ...data });
      },
      delete: (id) => {
        calls.push(['portals.delete', id]);
        return Promise.resolve();
      },
    },
  };

  const writes = () => calls.filter(([name]) => /create|update|delete/.test(name));
  return { client: pageClient(auth0), calls, writes };
}

describe('#portals handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  let warnStub;

  beforeEach(() => {
    config.data = { AUTH0_ALLOW_DELETE: true };
    warnStub = sinon.stub(log, 'warn');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#portals schema', () => {
    const ajv = new Ajv({ useDefaults: true, nullable: true });

    it('should pass validation with all fields', () => {
      const valid = ajv.validate(portals.schema, [
        {
          slug: 'support',
          name: 'Support Portal',
          client: { ...CLIENT, client_secret: 's3cret' },
          navigation: { sidebar: { components: [] } },
          pages: { default: 'home', standard: [] },
          custom_code: { head: '<style></style>' },
        },
      ]);
      expect(valid).to.equal(true);
    });

    it('should accept fields the API may add later and deprecated sidebar types', () => {
      const valid = ajv.validate(portals.schema, [
        {
          slug: 'support',
          name: 'Support Portal',
          future_field: true,
          navigation: {
            sidebar: {
              components: [
                {
                  type: 'sidebar:component:auth0:external_link',
                  config: { label: 'x', url: 'https://example.com' },
                },
              ],
            },
          },
        },
      ]);
      expect(valid).to.equal(true);
    });

    it('should fail validation without slug', () => {
      expect(ajv.validate(portals.schema, [{ name: 'No Slug' }])).to.equal(false);
    });

    it('should fail validation without name', () => {
      expect(ajv.validate(portals.schema, [{ slug: 'no-name' }])).to.equal(false);
    });

    it('should fail validation for a name over 150 characters', () => {
      expect(ajv.validate(portals.schema, [{ slug: 'long', name: 'x'.repeat(151) }])).to.equal(
        false
      );
    });
  });

  describe('#portals getResourceName', () => {
    it('should include the slug, since names are not unique', () => {
      const handler = new portals.default({ client: {}, config });
      expect(handler.getResourceName({ slug: 'support', name: 'Same Name' })).to.equal(
        'Same Name (support)'
      );
    });
  });

  describe('#portals validate', () => {
    const handler = new portals.default({ client: {}, config });

    it('should allow portals sharing a name, since names are not unique', async () => {
      await handler.validate({
        portals: [
          { slug: 'one', name: 'Same Name' },
          { slug: 'two', name: 'Same Name' },
        ],
      });
    });

    it('should reject duplicate slugs', async () => {
      const err = await rejection(async () => {
        await handler.validate({
          portals: [
            { slug: 'dup', name: 'A' },
            { slug: 'dup', name: 'B' },
          ],
        });
      });
      expect(err.message).to.include('multiple portals with the same slug: dup');
    });

    it('should reject duplicate ids', async () => {
      const err = await rejection(async () => {
        await handler.validate({
          portals: [
            { id: PORTAL_A, slug: 'one', name: 'A' },
            { id: PORTAL_A, slug: 'two', name: 'B' },
          ],
        });
      });
      expect(err.message).to.include('multiple portals with the same id');
    });

    it('should warn about deprecated sidebar types and still accept them', async () => {
      await handler.validate({
        portals: [
          {
            slug: 'legacy',
            name: 'Legacy',
            navigation: {
              sidebar: {
                components: [
                  {
                    type: 'sidebar:component:auth0:external_link',
                    config: { label: 'a', url: 'x' },
                  },
                  {
                    type: 'sidebar:component:auth0:external_link',
                    config: { label: 'b', url: 'y' },
                  },
                  {
                    type: 'sidebar:component:auth0:internal_link',
                    config: { label: 'c', to: 'z' },
                  },
                  {
                    type: 'sidebar:component:auth0:external_link:v2',
                    config: { label: 'd', href: 'w' },
                  },
                ],
              },
            },
          },
        ],
      });
      expect(warnStub.calledOnce).to.equal(true);
      const message = warnStub.firstCall.args[0];
      expect(message).to.include('Portal "legacy" uses deprecated sidebar component types');
      expect(message).to.include(
        'sidebar:component:auth0:external_link, sidebar:component:auth0:internal_link)'
      );
    });

    it('should not warn for v2 sidebar types', async () => {
      await handler.validate({
        portals: [
          {
            slug: 'modern',
            name: 'Modern',
            navigation: {
              sidebar: {
                components: [
                  {
                    type: 'sidebar:component:auth0:internal_link:v2',
                    config: { label: 'a', page_slug: 'home' },
                  },
                ],
              },
            },
          },
        ],
      });
      expect(warnStub.called).to.equal(false);
    });

    it('should do nothing when portals are not configured', async () => {
      await handler.validate({});
    });
  });

  describe('#portals getType', () => {
    it('should fetch each portal in full and drop the read-only timestamps', async () => {
      const { client, calls } = mockClient({ remote: [portalA(), portalB()] });
      const handler = new portals.default({ client, config });

      const existing = await handler.getType();

      expect(calls.filter(([name]) => name === 'portals.get').map(([, id]) => id)).to.have.members([
        PORTAL_A,
        PORTAL_B,
      ]);
      expect(existing).to.have.length(2);
      const support = existing.find((p) => p.slug === 'support');
      expect(support).to.deep.equal({
        id: PORTAL_A,
        slug: 'support',
        name: 'Support Portal',
        client: CLIENT,
        navigation: { sidebar: { components: [] } },
        pages: { default: 'home', standard: [{ title: 'Home', slug: 'home' }] },
        custom_code: { head: '<meta name="x" content="y">' },
      });
      expect(support.client).to.not.have.property('client_secret');
    });

    it('should return an empty list for a tenant without portals', async () => {
      const { client } = mockClient({ remote: [] });
      const handler = new portals.default({ client, config });
      expect(await handler.getType()).to.deep.equal([]);
    });

    it('should warn when the list reaches the API limit', async () => {
      const remote = Array.from({ length: 50 }, (_, i) => ({
        id: `up_${i}`,
        slug: `portal-${i}`,
        name: `Portal ${i}`,
        client: CLIENT,
        ...TS,
      }));
      const { client } = mockClient({ remote });
      const handler = new portals.default({ client, config });

      await handler.getType();

      expect(warnStub.calledOnce).to.equal(true);
      expect(warnStub.firstCall.args[0]).to.include('at most 50');
    });

    it('should not warn below the API limit', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      await new portals.default({ client, config }).getType();
      expect(warnStub.called).to.equal(false);
    });

    it('should return null when the feature is not enabled (403)', async () => {
      const { client } = mockClient({ listError: httpError(403, 'This feature is not enabled.') });
      const handler = new portals.default({ client, config });
      expect(await handler.getType()).to.equal(null);
    });

    it('should return null when the endpoint does not exist (404)', async () => {
      const { client } = mockClient({ listError: httpError(404, 'Not Found') });
      const handler = new portals.default({ client, config });
      expect(await handler.getType()).to.equal(null);
    });

    it('should rethrow a missing-scope 403 so the load wrapper can report it', async () => {
      const { client } = mockClient({
        listError: httpError(403, 'Insufficient scope, expected any of: read:portals'),
      });
      const handler = new portals.default({ client, config });
      const err = await rejection(async () => {
        await handler.getType();
      });
      expect(err.message).to.include('Insufficient scope');
    });

    it('should rethrow unexpected list errors', async () => {
      const { client } = mockClient({ listError: httpError(500, 'boom') });
      const handler = new portals.default({ client, config });
      const err = await rejection(async () => {
        await handler.getType();
      });
      expect(err.message).to.equal('boom');
    });

    it('should not treat a failing get as an unavailable feature', async () => {
      const { client } = mockClient({
        remote: [portalA()],
        getError: httpError(404, 'The portal does not exist.'),
      });
      const handler = new portals.default({ client, config });
      const err = await rejection(async () => {
        await handler.getType();
      });
      expect(err.message).to.include('does not exist');
    });
  });

  describe('#portals processChanges', () => {
    const configured = (overrides = {}) => ({
      slug: 'support',
      name: 'Support Portal',
      client: { ...CLIENT, client_secret: 's3cret' },
      navigation: { sidebar: { components: [] } },
      pages: { default: 'home' },
      custom_code: { head: '<style></style>' },
      ...overrides,
    });

    it('should do nothing when portals are not configured', async () => {
      const { client, calls } = mockClient();
      await new portals.default({ client, config }).processChanges({});
      expect(calls).to.deep.equal([]);
    });

    it('should create a portal with its client secret and drop null blocks', async () => {
      const { client, writes } = mockClient({ remote: [] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [configured({ id: 'ignored', navigation: null, created_at: 'x' })],
      });

      expect(writes()).to.deep.equal([
        [
          'portals.create',
          {
            slug: 'support',
            name: 'Support Portal',
            client: { ...CLIENT, client_secret: 's3cret' },
            pages: { default: 'home' },
            custom_code: { head: '<style></style>' },
          },
        ],
      ]);
    });

    it('should refuse to create a portal without a client secret before making any call', async () => {
      const { client, writes } = mockClient({ remote: [portalB()] });
      const handler = new portals.default({ client, config });

      const err = await rejection(async () => {
        await handler.processChanges({
          portals: [
            { slug: 'partners', name: 'Partners' },
            { slug: 'new-one', name: 'New', client: { ...CLIENT } },
          ],
        });
      });
      expect(err.message).to.include('"new-one"');
      expect(err.message).to.include('client.client_secret');
      expect(err.message).to.not.include('"partners"');
      expect(writes()).to.deep.equal([]);
    });

    it('should explain a slug conflict on a tenant above the list limit', async () => {
      const remote = Array.from({ length: 50 }, (_, i) => ({
        id: `up_${i}`,
        slug: `portal-${i}`,
        name: `Portal ${i}`,
        client: CLIENT,
        ...TS,
      }));
      const { client } = mockClient({ remote, createError: httpError(409, 'portal_conflict') });
      const err = await rejection(() =>
        new portals.default({ client, config: () => undefined }).processChanges({
          portals: [
            ...remote.map(({ id, created_at, updated_at, ...p }) => p),
            { slug: 'hidden', name: 'Hidden', client: { ...CLIENT, client_secret: 's3cret' } },
          ],
        })
      );
      expect(err.message).to.include('A portal with slug "hidden" already exists');
      expect(err.message).to.include('not among the first 50 portals');
      expect(err.message).to.not.include('s3cret');
    });

    it('should report a plain slug conflict below the list limit', async () => {
      const { client } = mockClient({ remote: [], createError: httpError(409, 'portal_conflict') });
      const err = await rejection(() =>
        new portals.default({ client, config }).processChanges({
          portals: [
            { slug: 'taken', name: 'Taken', client: { ...CLIENT, client_secret: 's3cret' } },
          ],
        })
      );
      expect(err.message).to.include('A portal with slug "taken" already exists on the tenant.');
      expect(err.message).to.not.include('not among');
    });

    it('should not leave the secret in the error raised for a failed create', async () => {
      const { client } = mockClient({ remote: [], createError: httpError(409, 'slug exists') });
      const handler = new portals.default({ client, config });
      const err = await rejection(async () => {
        await handler.processChanges({ portals: [configured()] });
      });
      expect(err.message).to.include('Problem creating portals');
      expect(err.message).to.not.include('s3cret');
    });

    it('should match by slug, not name, and update without sending an unchanged client', async () => {
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [
          {
            slug: 'support',
            name: 'Renamed Portal',
            client: { ...CLIENT },
            navigation: portalA().navigation,
            pages: portalA().pages,
            custom_code: portalA().custom_code,
          },
        ],
      });

      expect(writes()).to.have.length(1);
      const [name, id, payload] = writes()[0];
      expect(name).to.equal('portals.update');
      expect(id).to.equal(PORTAL_A);
      expect(payload.name).to.equal('Renamed Portal');
      expect(payload).to.not.have.property('client');
      expect(payload).to.not.have.property('id');
      expect(payload).to.not.have.property('created_at');
    });

    it('should send the full client block on update when a secret is configured', async () => {
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [configured({ client: { ...CLIENT, client_secret: 'rotated' } })],
      });

      expect(writes()[0][2].client).to.deep.equal({ ...CLIENT, client_secret: 'rotated' });
    });

    it('should warn when client_id changes without a secret and leave the client alone', async () => {
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [configured({ client: { ...CLIENT, client_id: 'other' } })],
      });

      expect(writes()[0][2]).to.not.have.property('client');
      expect(warnStub.args.map(([m]) => m).join()).to.include('client_id changed');
    });

    it('should clear blocks missing from the config when deletes are allowed', async () => {
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });

      const payload = writes()[0][2];
      expect(payload.navigation).to.equal(null);
      expect(payload.pages).to.equal(null);
      expect(payload.custom_code).to.equal(null);
    });

    it('should treat an empty YAML value (null) like an omitted block', async () => {
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [
          configured({
            navigation: null,
            pages: portalA().pages,
            custom_code: portalA().custom_code,
          }),
        ],
      });

      expect(writes()[0][2].navigation).to.equal(null);
      expect(writes()[0][2].pages).to.deep.equal(portalA().pages);
    });

    it('should not send null for a block that is unset on both sides', async () => {
      const { client, writes } = mockClient({ remote: [portalB()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [{ slug: 'partners', name: 'Partners', client: { ...CLIENT } }],
      });

      const payload = writes()[0][2];
      ['navigation', 'pages', 'custom_code'].forEach((field) =>
        expect(payload).to.not.have.property(field)
      );
    });

    it('should not clear blocks, and should warn, when deletes are not allowed', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const { client, writes } = mockClient({ remote: [portalA()] });
      const handler = new portals.default({ client, config });

      await handler.processChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });

      const payload = writes()[0][2];
      ['navigation', 'pages', 'custom_code'].forEach((field) =>
        expect(payload).to.not.have.property(field)
      );
      expect(warnStub.args.map(([m]) => m).join()).to.include('AUTH0_ALLOW_DELETE');
    });

    it('should delete portals missing from the config only when deletes are allowed', async () => {
      const { client, writes } = mockClient({ remote: [portalA(), portalB()] });
      await new portals.default({ client, config }).processChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });
      expect(writes().filter(([name]) => name === 'portals.delete')).to.deep.equal([
        ['portals.delete', PORTAL_B],
      ]);

      config.data.AUTH0_ALLOW_DELETE = false;
      const second = mockClient({ remote: [portalA(), portalB()] });
      await new portals.default({ client: second.client, config }).processChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });
      expect(second.writes().filter(([name]) => name === 'portals.delete')).to.deep.equal([]);
    });

    it('should skip with a warning and make no writes when the feature is not enabled', async () => {
      const { client, writes } = mockClient({ listError: httpError(403, 'not enabled') });
      const handler = new portals.default({ client, config });

      await handler.processChanges({ portals: [configured()] });

      expect(writes()).to.deep.equal([]);
      expect(warnStub.args.map(([m]) => m).join()).to.include('not enabled');
    });

    it('should never log the client secret', async () => {
      const infoStub = sinon.stub(log, 'info');
      const { client } = mockClient({ remote: [portalA()] });
      await new portals.default({ client, config }).processChanges({
        portals: [
          configured(),
          { slug: 'fresh', name: 'Fresh', client: { ...CLIENT, client_secret: 's3cret' } },
        ],
      });
      const logged = [...infoStub.args, ...warnStub.args].map(([m]) => String(m)).join('\n');
      expect(logged).to.not.include('s3cret');
    });
  });

  describe('#portals client application names', () => {
    const APP = { name: 'Portal App', client_id: 'abc123' };

    it('should resolve the application name to its id on create', async () => {
      const { client, writes } = mockClient({ remote: [], remoteClients: [APP] });
      await new portals.default({ client, config }).processChanges({
        portals: [
          {
            slug: 'support',
            name: 'Support',
            client: { ...CLIENT, client_id: 'Portal App', client_secret: 's3cret' },
          },
        ],
      });
      expect(writes()[0][1].client.client_id).to.equal('abc123');
    });

    it('should resolve the name on update and not warn when it is the same application', async () => {
      const { client, writes } = mockClient({ remote: [portalA()], remoteClients: [APP] });
      await new portals.default({ client, config }).processChanges({
        portals: [
          {
            slug: 'support',
            name: 'Support Portal',
            client: { ...CLIENT, client_id: 'Portal App' },
            navigation: portalA().navigation,
            pages: portalA().pages,
            custom_code: portalA().custom_code,
          },
        ],
      });
      expect(writes()[0][2]).to.not.have.property('client');
      expect(warnStub.args.map(([m]) => m).join()).to.not.include('client_id changed');
    });

    it('should send the resolved id with a rotated secret', async () => {
      const { client, writes } = mockClient({ remote: [portalA()], remoteClients: [APP] });
      await new portals.default({ client, config }).processChanges({
        portals: [
          {
            slug: 'support',
            name: 'Support Portal',
            client: { ...CLIENT, client_id: 'Portal App', client_secret: 'rotated' },
          },
        ],
      });
      expect(writes()[0][2].client).to.deep.equal({
        ...CLIENT,
        client_id: 'abc123',
        client_secret: 'rotated',
      });
    });

    it('should keep a value that matches no application as the raw id', async () => {
      const { client, writes } = mockClient({ remote: [], remoteClients: [APP] });
      await new portals.default({ client, config }).processChanges({
        portals: [
          {
            slug: 'support',
            name: 'Support',
            client: { ...CLIENT, client_id: 'external-id', client_secret: 's3cret' },
          },
        ],
      });
      expect(writes()[0][1].client.client_id).to.equal('external-id');
    });

    it('should not list applications when no portal sets a client_id', async () => {
      const { client, calls } = mockClient({ remote: [portalB()], remoteClients: [APP] });
      await new portals.default({ client, config }).processChanges({
        portals: [{ slug: 'partners', name: 'Partners' }],
      });
      expect(calls.filter(([name]) => name === 'clients.list')).to.deep.equal([]);
    });

    it('should resolve names in the dry-run normalization so the preview matches the tenant', async () => {
      const { client } = mockClient({ remote: [portalA()], remoteClients: [APP] });
      const normalized = await dryRunFormatAssets(
        {
          portals: [
            {
              slug: 'support',
              name: 'Support Portal',
              client: { ...CLIENT, client_id: 'Portal App' },
            },
          ],
        },
        client
      );
      expect(normalized.portals[0].client.client_id).to.equal('abc123');

      const handler = new portals.default({ client, config });
      const changes = await handler.dryRunChanges({
        portals: [
          {
            ...exportedA(),
            client: normalized.portals[0].client,
          },
        ],
      });
      expect(changes.update).to.deep.equal([]);
    });
  });

  describe('#portals form references', () => {
    const FORM = { id: 'ap_6mz5JtsXbeRqoArw7DkHbV', name: 'Signup Form' };
    const formComponent = (formId) => ({
      type: 'page:component:auth0:form',
      config: { form_id: formId, completion_message: 'Thanks' },
    });
    const withForms = (formRef) => ({
      slug: 'support',
      name: 'Support',
      client: { ...CLIENT, client_secret: 's3cret' },
      pages: {
        standard: [
          { title: 'Plain', slug: 'plain' },
          {
            title: 'Forms',
            slug: 'forms',
            components: [
              formComponent(formRef),
              {
                type: 'page:component:auth0:structure:section',
                config: { variant: 'card', children: [formComponent(formRef)] },
              },
            ],
          },
        ],
      },
    });
    const formIds = (portal) => {
      const [top, section] = portal.pages.standard[1].components;
      return [top.config.form_id, section.config.children[0].config.form_id];
    };

    it('should resolve form names to ids, including inside sections', async () => {
      const { client, writes } = mockClient({ remote: [], remoteForms: [FORM] });
      await new portals.default({ client, config }).processChanges({
        portals: [withForms('Signup Form')],
      });
      const sent = writes()[0][1];
      expect(formIds(sent)).to.deep.equal([FORM.id, FORM.id]);
      // Pages without components are left as they are
      expect(sent.pages.standard[0]).to.deep.equal({ title: 'Plain', slug: 'plain' });
    });

    it('should keep a form reference that matches no form as is', async () => {
      const { client, writes } = mockClient({ remote: [], remoteForms: [FORM] });
      await new portals.default({ client, config }).processChanges({
        portals: [withForms('ap_unknownFormId0000000000')],
      });
      expect(formIds(writes()[0][1])).to.deep.equal([
        'ap_unknownFormId0000000000',
        'ap_unknownFormId0000000000',
      ]);
    });

    it('should not list forms when no portal has a form component', async () => {
      const { client, calls } = mockClient({ remote: [portalB()], remoteForms: [FORM] });
      await new portals.default({ client, config }).processChanges({
        portals: [{ slug: 'partners', name: 'Partners' }],
      });
      expect(calls.filter(([name]) => name === 'forms.list')).to.deep.equal([]);
    });

    it('should resolve form names in the dry-run so an exported portal shows no changes', async () => {
      const remotePortal = { id: PORTAL_A, ...withForms(FORM.id), client: { ...CLIENT } };
      const { client } = mockClient({ remote: [remotePortal], remoteForms: [FORM] });
      const exported = { ...withForms('Signup Form'), client: { ...CLIENT } };

      const normalized = await dryRunFormatAssets({ portals: [exported] }, client);
      expect(formIds(normalized.portals[0])).to.deep.equal([FORM.id, FORM.id]);

      const changes = await new portals.default({ client, config }).dryRunChanges(normalized);
      expect(changes.update).to.deep.equal([]);
      expect(changes.create).to.deep.equal([]);
    });
  });

  describe('#portals dryRunChanges', () => {
    beforeEach(() => {
      config.data.AUTH0_DRY_RUN = true;
    });

    it('should make no write calls', async () => {
      const { client, writes } = mockClient({ remote: [portalA(), portalB()] });
      await new portals.default({ client, config }).dryRunChanges({
        portals: [
          { slug: 'support', name: 'Changed', client: { ...CLIENT } },
          { slug: 'brand-new', name: 'New', client: { ...CLIENT, client_secret: 's3cret' } },
        ],
      });
      expect(writes()).to.deep.equal([]);
    });

    it('should report create, update and delete by slug', async () => {
      const { client } = mockClient({ remote: [portalA(), portalB()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [
          {
            slug: 'support',
            name: 'Changed',
            client: { ...CLIENT },
            navigation: portalA().navigation,
            pages: portalA().pages,
            custom_code: portalA().custom_code,
          },
          { slug: 'brand-new', name: 'New', client: { ...CLIENT, client_secret: 's3cret' } },
        ],
      });

      expect(changes.create.map((p) => p.slug)).to.deep.equal(['brand-new']);
      expect(changes.update.map((p) => p.slug)).to.deep.equal(['support']);
      expect(changes.del.map((p) => p.slug)).to.deep.equal(['partners']);
    });

    it('should not report an update when only the write-only secret is configured', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [exportedA({ client: { ...CLIENT, client_secret: 's3cret' } })],
      });
      expect(changes.update).to.deep.equal([]);
    });

    it('should keep the configured secret out of the preview', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [
          exportedA({ name: 'Changed', client: { ...CLIENT, client_secret: 's3cret' } }),
          { slug: 'brand-new', name: 'New', client: { ...CLIENT, client_secret: 's3cret' } },
        ],
      });
      expect(JSON.stringify(changes)).to.not.include('s3cret');
      expect(changes.create[0].client).to.deep.equal(CLIENT);
    });

    it('should fail where the real import would: create without a secret', async () => {
      const { client } = mockClient({ remote: [] });
      const err = await rejection(async () => {
        await new portals.default({ client, config }).dryRunChanges({
          portals: [{ slug: 'new-one', name: 'New', client: { ...CLIENT } }],
        });
      });
      expect(err.message).to.include('client.client_secret');
    });

    it('should preview an update when the config drops a block the tenant has', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });
      expect(changes.update.map((p) => p.slug)).to.deep.equal(['support']);
    });

    it('should not preview clearing when deletes are not allowed', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [{ slug: 'support', name: 'Support Portal', client: { ...CLIENT } }],
      });
      expect(changes.update).to.deep.equal([]);
    });

    it('should warn like the real import when deletes are off and a block is missing', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const { client } = mockClient({ remote: [portalA()] });
      await new portals.default({ client, config }).dryRunChanges({
        portals: [exportedA({ custom_code: undefined })],
      });
      expect(warnStub.args.map(([m]) => m).join()).to.include(
        'custom_code is set on the tenant but missing from the config'
      );
    });

    it('should not preview an update for a client_id change that needs a secret, and warn', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [exportedA({ client: { ...CLIENT, client_id: 'other' } })],
      });
      expect(changes.update).to.deep.equal([]);
      expect(warnStub.args.map(([m]) => m).join()).to.include('client_id changed');
    });

    it('should still preview a real change alongside an unapplied client_id change', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [exportedA({ name: 'Renamed', client: { ...CLIENT, client_id: 'other' } })],
      });
      expect(changes.update.map((p) => p.slug)).to.deep.equal(['support']);
    });

    it('should preview an update when the client_id changes with a secret', async () => {
      const { client } = mockClient({ remote: [portalA()] });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [
          exportedA({ client: { ...CLIENT, client_id: 'other', client_secret: 's3cret' } }),
        ],
      });
      expect(changes.update.map((p) => p.slug)).to.deep.equal(['support']);
    });

    it('should return no changes when the feature is not enabled', async () => {
      const { client } = mockClient({ listError: httpError(403, 'not enabled') });
      const changes = await new portals.default({ client, config }).dryRunChanges({
        portals: [{ slug: 'a', name: 'A' }],
      });
      expect(changes).to.deep.equal({ del: [], create: [], conflicts: [], update: [] });
    });
  });
});
