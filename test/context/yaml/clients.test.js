import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/clients';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context clients', () => {
  it('should process clients', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clients');
    cleanThenMkdir(dir);

    const yaml = `
    clients:
      -
        name: "someClient"
        app_type: @@appType@@
      -
        name: "someClient2"
        app_type: "##appType##"
      -
        name: "customLoginClient"
        app_type: "##appType##"
        custom_login_page: "./customLoginClient_custom_login_page.html"
        session_transfer: {
        can_create_session_transfer_token: false,
        enforce_device_binding: 'none',
        allowed_authentication_methods: ['query']
      }
    `;

    const target = [
      { app_type: 'spa', name: 'someClient' },
      { app_type: 'spa', name: 'someClient2' },
      {
        app_type: 'spa',
        name: 'customLoginClient',
        custom_login_page: 'html code spa "spa"',
        session_transfer: {
          can_create_session_transfer_token: false,
          enforce_device_binding: 'none',
          allowed_authentication_methods: ['query'],
        },
      },
    ];

    const yamlFile = path.join(dir, 'clients1.yaml');
    const clientsPath = path.join(dir, 'clients');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(clientsPath);
    fs.writeFileSync(
      path.join(clientsPath, 'customLoginClient_custom_login_page.html'),
      'html code ##appType## @@appType@@'
    );

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );

    const clients = [
      { name: 'someClient', app_type: 'spa' },
      {
        name: 'customLoginClient',
        app_type: 'spa',
        custom_login_page: 'html code',
        session_transfer: {
          can_create_session_transfer_token: false,
          enforce_device_binding: 'none',
          allowed_authentication_methods: ['cookie', 'query'],
        },
      },
    ];

    const target = [
      { name: 'someClient', app_type: 'spa' },
      {
        name: 'customLoginClient',
        app_type: 'spa',
        custom_login_page: './customLoginClient_custom_login_page.html',
        session_transfer: {
          can_create_session_transfer_token: false,
          enforce_device_binding: 'none',
          allowed_authentication_methods: ['cookie', 'query'],
        },
      },
    ];

    context.assets.clients = clients;

    const dumped = await handler.dump(context);
    const clientsFolder = path.join(dir, 'clients');

    expect(dumped).to.deep.equal({ clients: target });
    expect(
      fs.readFileSync(path.join(clientsFolder, 'customLoginClient_custom_login_page.html'), 'utf8')
    ).to.deep.equal('html code');
  });

  it('should process clients with async_approval_notification_channels', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientsWithChannels');
    cleanThenMkdir(dir);

    const yaml = `
    clients:
      -
        name: "cibaClient"
        app_type: "spa"
        async_approval_notification_channels: ['guardian-push', 'email']
      -
        name: "emailOnlyClient"
        app_type: "native"
        async_approval_notification_channels: @@channels@@
    `;

    const target = [
      {
        name: 'cibaClient',
        app_type: 'spa',
        async_approval_notification_channels: ['guardian-push', 'email'],
      },
      {
        name: 'emailOnlyClient',
        app_type: 'native',
        async_approval_notification_channels: ['email'],
      },
    ];

    const yamlFile = path.join(dir, 'clients.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { channels: ['email'] },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients with async_approval_notification_channels', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientsChannelsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );

    const clients = [
      {
        name: 'cibaClient',
        app_type: 'spa',
        async_approval_notification_channels: ['email', 'guardian-push'],
      },
      {
        name: 'standardClient',
        app_type: 'native',
      },
    ];

    const target = [
      {
        name: 'cibaClient',
        app_type: 'spa',
        async_approval_notification_channels: ['email', 'guardian-push'],
      },
      {
        name: 'standardClient',
        app_type: 'native',
      },
    ];

    context.assets.clients = clients;

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ clients: target });
  });

  it('should process clients with token_exchange', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientsWithTokenExchange');
    cleanThenMkdir(dir);

    const yaml = `
    clients:
      -
        name: "tokenExchangeClient"
        app_type: "spa"
        token_exchange:
          allow_any_profile_of_type: ['custom_authentication']
      -
        name: "regularClient"
        app_type: "native"
    `;

    const target = [
      {
        name: 'tokenExchangeClient',
        app_type: 'spa',
        token_exchange: {
          allow_any_profile_of_type: ['custom_authentication'],
        },
      },
      {
        name: 'regularClient',
        app_type: 'native',
      },
    ];

    const yamlFile = path.join(dir, 'clients.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clients).to.deep.equal(target);
  });
});
