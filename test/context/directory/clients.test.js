import path from 'path';
import fs from 'fs-extra';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/clients';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context clients', () => {
  it('should process clients', async () => {
    const files = {
      [constants.CLIENTS_DIRECTORY]: {
        'someClient.json': '{ "app_type": "@@appType@@", "name": "someClient" }',
        'someClient2.json': '{ "app_type": "@@appType@@", "name": "someClient2" }',
        'customLoginClient.json':
          '{ "app_type": "@@appType@@", "name": "customLoginClient", "custom_login_page": "./customLoginClient_custom_login_page.html", ' +
          '"session_transfer": { "can_create_session_transfer_token": true, "enforce_cascade_revocation": true, "enforce_device_binding": "ip", "allowed_authentication_methods" : "@@allowedMethods@@", "allow_refresh_token": true, "enforce_online_refresh_tokens": true} }',
        'customLoginClient_custom_login_page.html': 'html code ##appType## @@appType@@',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clients1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa', allowedMethods: ['cookie', 'query'] },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        app_type: 'spa',
        name: 'customLoginClient',
        custom_login_page: 'html code spa "spa"',
        session_transfer: {
          can_create_session_transfer_token: true,
          enforce_cascade_revocation: true,
          enforce_device_binding: 'ip',
          allowed_authentication_methods: ['cookie', 'query'],
          allow_refresh_token: true,
          enforce_online_refresh_tokens: true,
        },
      },
      { app_type: 'spa', name: 'someClient' },
      { app_type: 'spa', name: 'someClient2' },
    ];
    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.CLIENTS_DIRECTORY]: {
        'someClient.json': '{ "app_type": @@appType@@, "name": "someClient" }',
        'README.md': 'something',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clients2');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [{ app_type: 'spa', name: 'someClient' }];

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should ignore bad clients directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'clients3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.CLIENTS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump clients', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      { app_type: 'spa', name: 'someClient' },
      { app_type: 'spa', name: 'someClient2' },
      {
        app_type: 'spa',
        name: 'customLoginClient',
        custom_login_page: 'html code',
        session_transfer: {
          can_create_session_transfer_token: false,
          enforce_cascade_revocation: false,
          enforce_device_binding: 'asn',
          allowed_authentication_methods: ['cookie'],
          allow_refresh_token: false,
          enforce_online_refresh_tokens: false,
        },
      },
    ];

    const customLoginClientTarget = {
      app_type: 'spa',
      name: 'customLoginClient',
      custom_login_page: './customLoginClient_custom_login_page.html',
      session_transfer: {
        can_create_session_transfer_token: false,
        enforce_cascade_revocation: false,
        enforce_device_binding: 'asn',
        allowed_authentication_methods: ['cookie'],
        allow_refresh_token: false,
        enforce_online_refresh_tokens: false,
      },
    };

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CLIENTS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'someClient.json'))).to.deep.equal(
      context.assets.clients[0]
    );
    expect(loadJSON(path.join(clientFolder, 'someClient2.json'))).to.deep.equal(
      context.assets.clients[1]
    );
    expect(loadJSON(path.join(clientFolder, 'customLoginClient.json'))).to.deep.equal(
      customLoginClientTarget
    );
    expect(
      fs.readFileSync(path.join(clientFolder, 'customLoginClient_custom_login_page.html'), 'utf8')
    ).to.equal('html code');
  });

  it('should dump clients sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      { app_type: 'spa', name: 'someClient-test' },
      { app_type: 'spa', name: 'someClient2/aa' },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CLIENTS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'someClient-test.json'))).to.deep.equal(
      context.assets.clients[0]
    );
    expect(loadJSON(path.join(clientFolder, 'someClient2-aa.json'))).to.deep.equal(
      context.assets.clients[1]
    );
  });

  it('should process clients with async_approval_notification_channels', async () => {
    const files = {
      [constants.CLIENTS_DIRECTORY]: {
        'cibaClient.json':
          '{ "app_type": "spa", "name": "cibaClient", "async_approval_notification_channels": ["email", "guardian-push"] }',
        'channelClient.json':
          '{ "app_type": "native", "name": "channelClient", "async_approval_notification_channels": @@channels@@ }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientsWithChannels');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { channels: ['guardian-push'] },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        app_type: 'native',
        name: 'channelClient',
        async_approval_notification_channels: ['guardian-push'],
      },
      {
        app_type: 'spa',
        name: 'cibaClient',
        async_approval_notification_channels: ['email', 'guardian-push'],
      },
    ];

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients with async_approval_notification_channels', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsChannelsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      {
        app_type: 'spa',
        name: 'cibaClient',
        async_approval_notification_channels: ['guardian-push', 'email'],
      },
      {
        app_type: 'native',
        name: 'standardClient',
      },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CLIENTS_DIRECTORY);

    expect(loadJSON(path.join(clientFolder, 'cibaClient.json'))).to.deep.equal({
      app_type: 'spa',
      name: 'cibaClient',
      async_approval_notification_channels: ['guardian-push', 'email'],
    });

    expect(loadJSON(path.join(clientFolder, 'standardClient.json'))).to.deep.equal({
      app_type: 'native',
      name: 'standardClient',
    });
  });

  it('should dump clients with express_configuration', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsDumpExpress');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      {
        name: 'someClient',
        app_type: 'regular_web',
        express_configuration: {
          user_attribute_profile_id: 'uap_123',
          connection_profile_id: 'cp_123',
          okta_oin_client_id: 'client_123',
        },
      },
    ];

    context.assets.userAttributeProfiles = [{ id: 'uap_123', name: 'My User Attribute Profile' }];

    context.assets.connectionProfiles = [{ id: 'cp_123', name: 'My Connection Profile' }];

    // Mock clients for okta_oin_client_id lookup
    // The dump method looks up in context.assets.clients
    context.assets.clients.push({
      client_id: 'client_123',
      name: 'My OIN Client',
    });

    await handler.dump(context);

    const dumpedClient = loadJSON(path.join(dir, 'clients', 'someClient.json'));
    expect(dumpedClient).to.deep.equal({
      name: 'someClient',
      app_type: 'regular_web',
      express_configuration: {
        user_attribute_profile_id: 'My User Attribute Profile',
        connection_profile_id: 'My Connection Profile',
        okta_oin_client_id: 'My OIN Client',
      },
    });
  });

  it('should dump clients with app_type express_configuration and filter fields', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsDumpExpressAppType');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      {
        name: 'someExpressClient',
        app_type: 'express_configuration',
        client_authentication_methods: {},
        organization_require_behavior: 'no_prompt',
        some_other_field: 'should be removed',
      },
    ];

    await handler.dump(context);

    const dumpedClient = loadJSON(path.join(dir, 'clients', 'someExpressClient.json'));
    expect(dumpedClient).to.deep.equal({
      name: 'someExpressClient',
      app_type: 'express_configuration',
      client_authentication_methods: {},
      organization_require_behavior: 'no_prompt',
    });
  });

  it('should process clients with oidc_logout', async () => {
    const files = {
      [constants.CLIENTS_DIRECTORY]: {
        'oidcLogoutClient.json':
          '{ "app_type": "regular_web", "name": "oidcLogoutClient", "oidc_logout": { "backchannel_logout_urls": ["https://example.com/logout"], "backchannel_logout_initiators": { "mode": "custom", "selected_initiators": ["rp-logout", "idp-logout"] }, "backchannel_logout_session_metadata": { "include": true } } }',
        'simpleClient.json': '{ "app_type": "spa", "name": "simpleClient" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientsWithOidcLogout');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        app_type: 'regular_web',
        name: 'oidcLogoutClient',
        oidc_logout: {
          backchannel_logout_urls: ['https://example.com/logout'],
          backchannel_logout_initiators: {
            mode: 'custom',
            selected_initiators: ['rp-logout', 'idp-logout'],
          },
          backchannel_logout_session_metadata: {
            include: true,
          },
        },
      },
      { app_type: 'spa', name: 'simpleClient' },
    ];
    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients with oidc_logout', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientsOidcLogoutDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clients = [
      {
        name: 'oidcLogoutClient',
        app_type: 'regular_web',
        oidc_logout: {
          backchannel_logout_urls: ['https://example.com/logout'],
          backchannel_logout_initiators: {
            mode: 'custom',
            selected_initiators: ['rp-logout', 'idp-logout'],
          },
          backchannel_logout_session_metadata: {
            include: true,
          },
        },
      },
    ];

    await handler.dump(context);

    const dumpedClient = loadJSON(path.join(dir, 'clients', 'oidcLogoutClient.json'));
    expect(dumpedClient).to.deep.equal({
      name: 'oidcLogoutClient',
      app_type: 'regular_web',
      oidc_logout: {
        backchannel_logout_urls: ['https://example.com/logout'],
        backchannel_logout_initiators: {
          mode: 'custom',
          selected_initiators: ['rp-logout', 'idp-logout'],
        },
        backchannel_logout_session_metadata: {
          include: true,
        },
      },
    });
  });
});
