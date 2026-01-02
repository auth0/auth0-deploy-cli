import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/actions';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context actions', () => {
  it('should process actions', async () => {
    const dir = path.join(testDataDir, 'yaml', 'action-one');
    cleanThenMkdir(dir);

    const codeContext =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };';
    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    actions:
      - name: action-one
        code: "${codeFile}"
        runtime: node12
        dependencies:
          - name: lodash
            version: 4.17.21
        deployed: true
        secrets: []
        status: built
        supported_triggers:
          - id: post-login
            version: v1
    `;
    const yamlFile = path.join(dir, 'action-one.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'action-one',
        code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
        runtime: 'node12',
        status: 'built',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.21',
          },
        ],
        secrets: [],
        deployed: true,
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-action' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actions).to.deep.equal(target);
  });

  it('should process YAML with includes', async () => {
    const dir = path.join(testDataDir, 'yaml', 'includes');
    cleanThenMkdir(dir);

    const clientsYaml = `
- name: "Test Client"
  app_type: "spa"
- name: "Test M2M"
  app_type: "non_interactive"
    `;
    const clientsFile = path.join(dir, 'clients.yaml');
    fs.writeFileSync(clientsFile, clientsYaml);

    const mainYaml = `
tenant:
  friendly_name: 'Test Tenant'

clients: !include clients.yaml
    `;
    const mainFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(mainFile, mainYaml);

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal({
      friendly_name: 'Test Tenant',
    });
    expect(context.assets.clients).to.deep.equal([
      {
        name: 'Test Client',
        app_type: 'spa',
      },
      {
        name: 'Test M2M',
        app_type: 'non_interactive',
      },
    ]);
  });

  it('should handle nested includes', async () => {
    const dir = path.join(testDataDir, 'yaml', 'nested-includes');
    cleanThenMkdir(dir);

    const rolesYaml = `
- name: Admin
  description: Administrator
- name: User
  description: Regular User
    `;
    fs.writeFileSync(path.join(dir, 'roles.yaml'), rolesYaml);

    const mainYaml = `
tenant:
  friendly_name: 'Main Tenant'

roles: !include roles.yaml
    `;
    fs.writeFileSync(path.join(dir, 'tenant.yaml'), mainYaml);

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.roles).to.deep.equal([
      { name: 'Admin', description: 'Administrator' },
      { name: 'User', description: 'Regular User' },
    ]);
  });

  it('should error on missing include file', async () => {
    const dir = path.join(testDataDir, 'yaml', 'missing-include');
    cleanThenMkdir(dir);

    const mainYaml = `
clients: !include missing.yaml
    `;
    fs.writeFileSync(path.join(dir, 'tenant.yaml'), mainYaml);

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());
    
    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Include file not found/
    );
  });

  it('should dump actions', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') },
      mockMgmtClient()
    );
    const codeValidation =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: 'action-one',
        code: codeValidation,
        runtime: 'node12',
        status: 'built',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20',
          },
        ],
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        secrets: [],
        deployed: true,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actions: [
        {
          name: 'action-one',
          code: './actions/action-one/code.js',
          runtime: 'node12',
          status: 'built',
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.20',
            },
          ],
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
          secrets: [],
          deployed: true,
        },
      ],
    });

    const actionsFolder = path.join(dir, 'actions', 'action-one');
    expect(fs.readFileSync(path.join(actionsFolder, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should dump actions with identifiers when AUTH0_EXPORT_IDENTIFIERS is true', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionsDumpWithId');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml'), AUTH0_EXPORT_IDENTIFIERS: true },
      mockMgmtClient()
    );
    const codeValidation =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        id: 'act_123',
        name: 'action-one',
        code: codeValidation,
        runtime: 'node12',
        status: 'built',
        dependencies: [],
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        secrets: [],
        deployed: true,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actions: [
        {
          id: 'act_123',
          name: 'action-one',
          code: './actions/action-one/code.js',
          runtime: 'node12',
          status: 'built',
          dependencies: [],
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
          secrets: [],
          deployed: true,
        },
      ],
    });

    const actionsFolder = path.join(dir, 'actions', 'action-one');
    expect(fs.readFileSync(path.join(actionsFolder, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should exclude marketplace actions during dump', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') },
      mockMgmtClient()
    );

    const marketplaceAction = {
      id: 'D1AF7CCF-7ZAB-417F-81C0-533595A926D8',
      name: 'Travel0 Integration',
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1',
        },
      ],
      created_at: '2022-08-22T23:57:45.856907897Z',
      updated_at: '2022-08-22T23:57:45.856907897Z',
      installed_integration_id: '73f156dc-e7aa-47b4-9dda-0ef741205c31',
      integration: {
        id: '046042e2-5732-48ef-9313-0a93778ea8b1',
        catalog_id: 'travel0-action',
        url_slug: 'travel0-sms',
        partner_id: 'bea44019-d08d-47cd-b4f9-30074ca2ab69',
        name: 'Travel0',
        logo: 'https://cdn.auth0.com/travel0-logo.png',
        updated_at: '2022-05-03T15:05:45.684007768Z',
        created_at: '2021-08-24T20:49:30.446854653Z',
        feature_type: 'action',
        current_release: {
          id: '',
          semver: {},
        },
        all_changes_deployed: false,
      },
    };

    context.assets.actions = [marketplaceAction];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actions: [],
    });
  });
});
