import fs from 'fs-extra';
import path from 'path';
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
    `;

    const target = [
      { app_type: 'spa', name: 'someClient' },
      { app_type: 'spa', name: 'someClient2' },
      { app_type: 'spa', name: 'customLoginClient', custom_login_page: 'html code spa "spa"' }
    ];

    const yamlFile = path.join(dir, 'clients1.yaml');
    const clientsPath = path.join(dir, 'clients');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(clientsPath);
    fs.writeFileSync(path.join(clientsPath, 'customLoginClient_custom_login_page.html'), 'html code ##appType## @@appType@@');

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, './test.yml') }, mockMgmtClient());

    const clients = [
      { name: 'someClient', app_type: 'spa' },
      { name: 'customLoginClient', app_type: 'spa', custom_login_page: 'html code' }
    ];

    const target = [
      { name: 'someClient', app_type: 'spa' },
      { name: 'customLoginClient', app_type: 'spa', custom_login_page: './customLoginClient_custom_login_page.html' }
    ];

    context.assets.clients = clients;

    const dumped = await handler.dump(context);
    const clientsFolder = path.join(dir, 'clients');

    expect(dumped).to.deep.equal({ clients: target });
    expect(fs.readFileSync(path.join(clientsFolder, 'customLoginClient_custom_login_page.html'), 'utf8')).to.deep.equal('html code');
  });
});
