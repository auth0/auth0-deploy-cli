import { expect } from 'chai';
import * as sinon from 'sinon';
import { calculateDryRunChanges, dryRunFormatAssets } from '../../src/tools/calculateDryRunChanges';
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
});
