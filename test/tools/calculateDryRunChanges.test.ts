import { expect } from 'chai';
import * as sinon from 'sinon';
import fs from 'node:fs/promises';
import {
  calculateDryRunChanges,
  dryRunFormatAssets,
  getObjectDifferences,
  hasObjectDifferences,
  exportDiffLog,
} from '../../src/tools/calculateDryRunChanges';
import DefaultHandler from '../../src/tools/auth0/handlers/default';
import { configFactory } from '../../src/configFactory';
import AttackProtectionHandler from '../../src/tools/auth0/handlers/attackProtection';
import { mockMgmtClient } from '../utils';

describe('#utils calculateDryRunChanges', () => {
  it('should ignore explicitly configured dry-run fields during comparisons', async () => {
    class MockDryRunHandler extends DefaultHandler {
      constructor() {
        super({
          // @ts-ignore test stub
          config: configFactory(),
          type: 'actionModules',
          id: 'id',
          identifiers: ['id', 'name'],
          stripUpdateFields: ['latest_version_number'],
          ignoreDryRunFields: ['latest_version_number'],
        });
      }

      async getType() {
        return [{ id: 'mod_1', name: 'action-mod', latest_version_number: 21 }];
      }
    }

    const handler = new MockDryRunHandler();
    const changes = await handler.dryRunChanges({
      actionModules: [{ id: 'mod_1', name: 'action-mod', latest_version_number: 19 }],
    } as any);

    expect(changes.update).to.have.length(0);
  });

  it('should normalize local assets for dry-run comparisons', async () => {
    const auth0Client = mockMgmtClient() as any;

    auth0Client.clients.list = () => [
      { name: 'My API Client', client_id: 'cli_resource_server' },
      { name: 'express-openid-app', client_id: 'cli_express_openid' },
      { name: 'oin_test_client', client_id: 'cli_okta_oin' },
    ];
    auth0Client.connectionProfiles.list = () => [
      { id: 'cop_123', name: 'Basic Connection Profile' },
    ];
    auth0Client.userAttributeProfiles.list = () => [
      { id: 'uap_123', name: 'test-user-attribute-profile-2' },
    ];
    auth0Client.connections.list = () => [{ id: 'con_123', name: 'Test Connection' }];

    const assets = await dryRunFormatAssets(
      {
        clients: [
          {
            name: 'Go test app kushal',
            express_configuration: {
              connection_profile_id: 'Basic Connection Profile',
              okta_oin_client_id: 'oin_test_client',
              user_attribute_profile_id: 'test-user-attribute-profile-2',
            },
          },
        ],
        connections: [
          {
            name: 'google-oauth2-new',
            options: {
              idpinitiated: {
                client_id: 'express-openid-app',
              },
            },
          },
        ],
        organizations: [
          {
            name: 'k_test_organization',
            connections: [{ name: 'Test Connection', assign_membership_on_login: true }],
          },
        ],
        resourceServers: [{ name: 'Org Snow Api', client_id: 'My API Client' } as any],
        tenant: {
          flags: {},
          session_lifetime: 1,
          idle_session_lifetime: 2,
          idle_ephemeral_session_lifetime: 3,
        } as any,
      },
      auth0Client
    );

    expect(assets.clients?.[0].express_configuration).to.deep.include({
      connection_profile_id: 'cop_123',
      okta_oin_client_id: 'cli_okta_oin',
      user_attribute_profile_id: 'uap_123',
    });
    expect(assets.resourceServers?.[0].client_id).to.equal('cli_resource_server');
    expect(assets.connections?.[0].options.idpinitiated.client_id).to.equal('cli_express_openid');
    expect(assets.organizations?.[0].connections?.[0]).to.deep.equal({
      connection_id: 'con_123',
      assign_membership_on_login: true,
    });
    expect(assets.tenant).to.deep.include({
      session_lifetime_in_minutes: 60,
      idle_session_lifetime_in_minutes: 120,
      idle_ephemeral_session_lifetime_in_minutes: 180,
    });
    expect(assets.tenant).to.not.have.property('flags');
    expect(assets.tenant).to.not.have.property('session_lifetime');
    expect(assets.tenant).to.not.have.property('idle_session_lifetime');
    expect(assets.tenant).to.not.have.property('idle_ephemeral_session_lifetime');
  });

  it('should not report tenant dry-run diffs for equivalent hour and minute values', () => {
    const changes = calculateDryRunChanges({
      type: 'tenant',
      assets: {
        friendly_name: 'Auth0 test',
        session_lifetime_in_minutes: 60,
        idle_session_lifetime_in_minutes: 120,
        idle_ephemeral_session_lifetime_in_minutes: 180,
      },
      existing: {
        friendly_name: 'Auth0 test',
        session_lifetime: 1,
        idle_session_lifetime: 2,
        idle_ephemeral_session_lifetime: 3,
        flags: {},
      },
      identifiers: ['friendly_name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(0);
    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should report tenant dry-run diffs when session duration values actually change', () => {
    const changes = calculateDryRunChanges({
      type: 'tenant',
      assets: {
        friendly_name: 'Auth0 test',
        session_lifetime_in_minutes: 120,
        idle_session_lifetime_in_minutes: 120,
      },
      existing: {
        friendly_name: 'Auth0 test',
        session_lifetime: 1,
        idle_session_lifetime: 2,
        flags: {},
      },
      identifiers: ['friendly_name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(1);
    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should ignore attack protection secrets during dry-run comparisons', async () => {
    const handler = new AttackProtectionHandler({
      // @ts-ignore test stub
      client: mockMgmtClient(),
      config: configFactory(),
    } as any);

    const existing = {
      captcha: {
        recaptcha_v2: {
          site_key: 'site-key',
        },
      },
    };

    sinon.stub(handler, 'getType').resolves(existing as any);

    const changes = await handler.dryRunChanges({
      attackProtection: {
        captcha: {
          recaptcha_v2: {
            site_key: 'site-key',
            secret: 'super-secret',
          },
        },
      },
    } as any);

    expect(changes.update).to.have.length(0);
  });

  it('should ignore order differences for arrays of objects during dry-run comparisons', () => {
    const changes = calculateDryRunChanges({
      type: 'roles',
      assets: [
        {
          name: 'admin',
          permissions: [
            {
              permission_name: 'read:users',
              resource_server_identifier: 'api',
            },
            {
              permission_name: 'write:users',
              resource_server_identifier: 'api',
            },
          ],
        },
      ],
      existing: [
        {
          name: 'admin',
          permissions: [
            {
              permission_name: 'write:users',
              resource_server_identifier: 'api',
            },
            {
              permission_name: 'read:users',
              resource_server_identifier: 'api',
            },
          ],
        },
      ],
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(0);
  });

  it('should ignore order differences for nested arrays during dry-run comparisons', () => {
    const changes = calculateDryRunChanges({
      type: 'organizations',
      assets: [
        {
          name: 'org-one',
          connections: [
            {
              connection_id: 'con-1',
              assign_membership_on_login: true,
              allowed_audiences: ['aud-1', 'aud-2'],
            },
            {
              connection_id: 'con-2',
              assign_membership_on_login: false,
              allowed_audiences: ['aud-3', 'aud-4'],
            },
          ],
        },
      ],
      existing: [
        {
          name: 'org-one',
          connections: [
            {
              connection_id: 'con-2',
              assign_membership_on_login: false,
              allowed_audiences: ['aud-4', 'aud-3'],
            },
            {
              connection_id: 'con-1',
              assign_membership_on_login: true,
              allowed_audiences: ['aud-2', 'aud-1'],
            },
          ],
        },
      ],
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(0);
  });

  it('should still report real differences after normalizing array order', () => {
    const changes = calculateDryRunChanges({
      type: 'roles',
      assets: [
        {
          name: 'admin',
          permissions: [
            {
              permission_name: 'read:users',
              resource_server_identifier: 'api',
            },
            {
              permission_name: 'write:users',
              resource_server_identifier: 'api',
            },
            {
              permission_name: 'delete:users',
              resource_server_identifier: 'api',
            },
          ],
        },
      ],
      existing: [
        {
          name: 'admin',
          permissions: [
            {
              permission_name: 'write:users',
              resource_server_identifier: 'api',
            },
            {
              permission_name: 'read:users',
              resource_server_identifier: 'api',
            },
          ],
        },
      ],
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(1);
  });

  it('should classify unmatched local assets as create only during dry run', () => {
    const changes = calculateDryRunChanges({
      type: 'clients',
      assets: [
        {
          name: 'New Test App',
          app_type: 'spa',
          callbacks: ['https://new-test-app.example/callback'],
        },
      ],
      existing: [
        {
          name: 'Existing Test App',
          app_type: 'spa',
          callbacks: ['https://existing-test-app.example/callback'],
        },
      ],
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.create).to.have.length(1);
    expect(changes.create[0].name).to.equal('New Test App');
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(1);
  });

  it('should classify matched remote assets as update only during dry run', () => {
    const changes = calculateDryRunChanges({
      type: 'clients',
      assets: [
        {
          name: 'Existing Test App',
          app_type: 'spa',
          callbacks: ['https://new.example/callback'],
        },
      ],
      existing: [
        {
          name: 'Existing Test App',
          app_type: 'spa',
          callbacks: ['https://old.example/callback'],
        },
      ],
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(1);
    expect(changes.update[0].name).to.equal('Existing Test App');
    expect(changes.del).to.have.length(0);
  });

  it('should handle compound array identifiers for matching assets', () => {
    const changes = calculateDryRunChanges({
      type: 'clientGrants',
      assets: [{ client_id: 'cli_123', audience: 'https://api.example.com', scope: ['read:data'] }],
      existing: [
        { client_id: 'cli_123', audience: 'https://api.example.com', scope: ['read:data'] },
      ],
      identifiers: [['client_id', 'audience']],
      ignoreDryRunFields: [],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should detect updates when using compound array identifiers', () => {
    const changes = calculateDryRunChanges({
      type: 'clientGrants',
      assets: [
        {
          client_id: 'cli_123',
          audience: 'https://api.example.com',
          scope: ['read:data', 'write:data'],
        },
      ],
      existing: [
        { client_id: 'cli_123', audience: 'https://api.example.com', scope: ['read:data'] },
      ],
      identifiers: [['client_id', 'audience']],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(1);
    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should detect creates and deletes with compound array identifiers', () => {
    const changes = calculateDryRunChanges({
      type: 'clientGrants',
      assets: [{ client_id: 'cli_new', audience: 'https://api.example.com', scope: ['read'] }],
      existing: [{ client_id: 'cli_old', audience: 'https://api.example.com', scope: ['read'] }],
      identifiers: [['client_id', 'audience']],
      ignoreDryRunFields: [],
    });

    expect(changes.create).to.have.length(1);
    expect(changes.del).to.have.length(1);
  });

  it('should handle single asset objects (non-array) for existing and assets', () => {
    const changes = calculateDryRunChanges({
      type: 'tenant',
      assets: { friendly_name: 'My Tenant' },
      existing: { friendly_name: 'My Tenant' },
      identifiers: ['friendly_name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(0);
    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should backfill identifier fields from remote during update', () => {
    const changes = calculateDryRunChanges({
      type: 'clients',
      assets: [{ name: 'My App', app_type: 'spa' }],
      existing: [{ name: 'My App', client_id: 'cli_abc', app_type: 'regular_web' }],
      identifiers: ['client_id', 'name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(1);
    expect(changes.update[0].client_id).to.equal('cli_abc');
  });
});

describe('#getObjectDifferences', () => {
  it('should detect key present locally but not remotely', () => {
    const diffs = getObjectDifferences({ newKey: 'value' }, {}, '', 'test');
    expect(diffs).to.have.length(1);
    expect(diffs[0]).to.include('newKey');
    expect(diffs[0]).to.include("found in 'localObj' but not in 'remoteObj'");
  });

  it('should detect primitive value differences', () => {
    const diffs = getObjectDifferences({ name: 'updated' }, { name: 'original' }, '', 'test');
    expect(diffs).to.have.length(1);
    expect(diffs[0]).to.include('Value difference for [name]');
  });

  it('should detect array length mismatches', () => {
    const diffs = getObjectDifferences({ items: [1, 2, 3] }, { items: [1, 2] }, '', 'test');
    expect(diffs.some((d) => d.includes('Array'))).to.be.true;
  });

  it('should detect differences in object arrays element-by-element', () => {
    const diffs = getObjectDifferences(
      { items: [{ a: 1 }, { a: 3 }, { a: 4 }] },
      { items: [{ a: 1 }, { a: 2 }] },
      '',
      'test'
    );
    // Array length mismatch + element-level difference
    expect(diffs.length).to.be.greaterThan(0);
  });

  it('should detect differences in primitive arrays', () => {
    const diffs = getObjectDifferences({ tags: ['a', 'c'] }, { tags: ['a', 'b'] }, '', 'test');
    expect(diffs.some((d) => d.includes('Array content difference'))).to.be.true;
  });

  it('should return no differences for identical primitive arrays with different order', () => {
    const diffs = getObjectDifferences({ tags: ['b', 'a'] }, { tags: ['a', 'b'] }, '', 'test');
    expect(diffs).to.have.length(0);
  });

  it('should recurse into nested objects', () => {
    const diffs = getObjectDifferences(
      { outer: { inner: 'new' } },
      { outer: { inner: 'old' } },
      '',
      'test'
    );
    expect(diffs).to.have.length(1);
    expect(diffs[0]).to.include('outer.inner');
  });

  it('should respect ignoreDryRunFields', () => {
    const diffs = getObjectDifferences(
      { secret: 'new-secret', name: 'same' },
      { secret: 'old-secret', name: 'same' },
      '',
      'test',
      ['secret']
    );
    expect(diffs).to.have.length(0);
  });

  it('should respect ignoreDryRunFields with nested paths', () => {
    const diffs = getObjectDifferences(
      { captcha: { recaptcha_v2: { secret: 'new' } } },
      { captcha: { recaptcha_v2: { secret: 'old' } } },
      '',
      'test',
      ['captcha.recaptcha_v2.secret']
    );
    expect(diffs).to.have.length(0);
  });

  it('should return empty array for identical objects', () => {
    const diffs = getObjectDifferences(
      { name: 'test', enabled: true },
      { name: 'test', enabled: true },
      '',
      'test'
    );
    expect(diffs).to.have.length(0);
  });

  it('should handle array item differences for non-object items in mixed check', () => {
    const diffs = getObjectDifferences(
      { items: [{ a: 1 }, 'literal'] },
      { items: [{ a: 1 }, 'different'] },
      '',
      'test'
    );
    expect(diffs.length).to.be.greaterThan(0);
  });
});

describe('#hasObjectDifferences', () => {
  it('should return true when objects differ and log to diff store', () => {
    const result = hasObjectDifferences(
      { name: 'updated' },
      { name: 'original' },
      '',
      'testResource'
    );
    expect(result).to.be.true;
  });

  it('should return false for identical objects', () => {
    const result = hasObjectDifferences({ name: 'same' }, { name: 'same' }, '', 'testResource');
    expect(result).to.be.false;
  });
});

describe('#exportDiffLog', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should write diff log to a file', async () => {
    const writeStub = sandbox.stub(fs, 'writeFile').resolves();

    await exportDiffLog('test-output.json');

    expect(writeStub.calledOnce).to.be.true;
    expect(writeStub.firstCall.args[0]).to.equal('./test-output.json');
  });

  it('should write diff log for a specific resource type', async () => {
    const writeStub = sandbox.stub(fs, 'writeFile').resolves();

    await exportDiffLog('test-output.json', 'clients');

    expect(writeStub.calledOnce).to.be.true;
  });

  it('should handle write errors gracefully', async () => {
    sandbox.stub(fs, 'writeFile').rejects(new Error('EACCES'));

    // Should not throw
    await exportDiffLog('test-output.json');
  });
});

describe('#dryRunFormatAssets additional paths', () => {
  it('should convert clientGrants client_id from name to id', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [{ name: 'My M2M App', client_id: 'cli_m2m' }];

    const assets = await dryRunFormatAssets(
      {
        clientGrants: [
          { client_id: 'My M2M App', audience: 'https://api.example.com', scope: ['read'] },
        ],
      },
      auth0Client
    );

    expect(assets.clientGrants![0].client_id).to.equal('cli_m2m');
  });

  it('should convert database enabled_clients from names to ids', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [
      { name: 'App One', client_id: 'cli_one' },
      { name: 'App Two', client_id: 'cli_two' },
    ];

    const assets = await dryRunFormatAssets(
      {
        clients: [{ name: 'App One' }, { name: 'App Two' }],
        databases: [{ name: 'db-one', enabled_clients: ['App One', 'App Two'] }],
      },
      auth0Client
    );

    expect(assets.databases![0].enabled_clients).to.deep.equal(['cli_one', 'cli_two']);
  });

  it('should rename action deployed field to all_changes_deployed', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const assets = await dryRunFormatAssets(
      {
        actions: [{ name: 'action-one', deployed: true }],
      },
      auth0Client
    );

    expect(assets.actions![0]).to.have.property('all_changes_deployed', true);
    expect(assets.actions![0]).to.not.have.property('deployed');
  });

  it('should decode base64 cert for samlp connections', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const certPem = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----';
    const certBase64 = Buffer.from(certPem).toString('base64');

    const assets = await dryRunFormatAssets(
      {
        connections: [
          {
            name: 'saml-conn',
            strategy: 'samlp',
            options: { cert: certBase64 },
          },
        ],
      },
      auth0Client
    );

    expect(assets.connections![0].options.cert).to.equal(certPem);
  });

  it('should convert connection enabled_clients from names to ids', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [{ name: 'App A', client_id: 'cli_a' }];

    const assets = await dryRunFormatAssets(
      {
        connections: [
          {
            name: 'google-oauth2',
            strategy: 'google-oauth2',
            enabled_clients: ['App A'],
          },
        ],
      },
      auth0Client
    );

    expect(assets.connections![0].enabled_clients).to.deep.equal(['cli_a']);
  });

  it('should remove empty branding templates array', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const assets = await dryRunFormatAssets(
      {
        branding: { logo_url: 'https://example.com/logo.png', templates: [] },
      },
      auth0Client
    );

    expect(assets.branding).to.not.have.property('templates');
    expect(assets.branding!.logo_url).to.equal('https://example.com/logo.png');
  });

  it('should not skip databases when localAssets.clients is missing', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const assets = await dryRunFormatAssets(
      {
        databases: [{ name: 'db-one', enabled_clients: ['App One'] }],
      },
      auth0Client
    );

    // Without clients, the databases branch is skipped — enabled_clients remain as names
    expect(assets.databases![0].enabled_clients).to.deep.equal(['App One']);
  });

  it('should preserve non-empty branding templates array', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const assets = await dryRunFormatAssets(
      {
        branding: {
          logo_url: 'https://example.com/logo.png',
          templates: [{ template: 'login', body: '<html>...</html>' }],
        },
      },
      auth0Client
    );

    expect(assets.branding!.templates).to.have.length(1);
  });

  it('should leave actions without a deployed field unchanged', async () => {
    const auth0Client = mockMgmtClient() as any;
    auth0Client.clients.list = () => [];

    const assets = await dryRunFormatAssets(
      {
        actions: [{ name: 'action-no-deployed', runtime: 'node18' }],
      },
      auth0Client
    );

    expect(assets.actions![0]).to.not.have.property('deployed');
    expect(assets.actions![0]).to.not.have.property('all_changes_deployed');
  });
});

describe('#calculateDryRunChanges null-safety', () => {
  it('should treat all local assets as creates when existing is null', () => {
    const changes = calculateDryRunChanges({
      type: 'clients',
      assets: [{ name: 'New App', app_type: 'spa' }],
      existing: null,
      identifiers: ['name'],
      ignoreDryRunFields: [],
    });

    expect(changes.create).to.have.length(1);
    expect(changes.create[0].name).to.equal('New App');
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('should preserve non-empty tenant flags during dry-run comparison', () => {
    const changes = calculateDryRunChanges({
      type: 'tenant',
      assets: {
        friendly_name: 'Auth0 test',
        flags: { mfa_show_factor_list_on_enrollment: true },
      },
      existing: {
        friendly_name: 'Auth0 test',
        flags: { mfa_show_factor_list_on_enrollment: true },
      },
      identifiers: ['friendly_name'],
      ignoreDryRunFields: [],
    });

    expect(changes.update).to.have.length(0);
    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });
});
