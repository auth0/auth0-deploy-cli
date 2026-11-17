import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/portals';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context portals', () => {
  it('should process portals with keyword replacement', async () => {
    const dir = path.join(testDataDir, 'yaml', 'portals');
    cleanThenMkdir(dir);

    const yaml = `
    portals:
      - slug: support
        name: "##PORTAL_NAME##"
        client:
          token_endpoint_auth_method: client_secret_post
          client_id: abc123
          client_secret: "##PORTAL_CLIENT_SECRET##"
        pages:
          default: home
          standard:
            - title: Home
              slug: home
              components: @@HOME_COMPONENTS@@
    `;
    const yamlFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        PORTAL_NAME: 'Support Portal',
        PORTAL_CLIENT_SECRET: 's3cret',
        HOME_COMPONENTS: [
          { type: 'page:component:auth0:typography:heading', config: { title: 'Hi' } },
        ],
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.portals).to.deep.equal([
      {
        slug: 'support',
        name: 'Support Portal',
        client: {
          token_endpoint_auth_method: 'client_secret_post',
          client_id: 'abc123',
          client_secret: 's3cret',
        },
        pages: {
          default: 'home',
          standard: [
            {
              title: 'Home',
              slug: 'home',
              components: [
                { type: 'page:component:auth0:typography:heading', config: { title: 'Hi' } },
              ],
            },
          ],
        },
      },
    ]);
  });

  it('should leave portals unset when the key is absent', async () => {
    const dir = path.join(testDataDir, 'yaml', 'portalsAbsent');
    cleanThenMkdir(dir);
    const yamlFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(yamlFile, 'tenant:\n  friendly_name: x\n');

    const context = new Context({ AUTH0_INPUT_FILE: yamlFile }, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.portals).to.equal(null);
  });

  it('should dump portals without ids or timestamps and never a secret', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.portals = [
      {
        id: 'up_8RkL2mNpQ3sT4uV5wX6yZa',
        slug: 'support',
        name: 'Support Portal',
        client: {
          token_endpoint_auth_method: 'client_secret_post',
          client_id: 'abc123',
          client_secret: 'must-not-be-exported',
        },
        custom_code: { head: '<style></style>' },
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-02T00:00:00.000Z',
      },
    ];

    expect(await handler.dump(context)).to.deep.equal({
      portals: [
        {
          slug: 'support',
          name: 'Support Portal',
          client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
          custom_code: { head: '<style></style>' },
        },
      ],
    });
  });

  it('should dump the client application by name', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.clients = [{ name: 'Portal App', client_id: 'abc123' }];
    context.assets.portals = [
      {
        id: 'up_1',
        slug: 'support',
        name: 'Support',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
      },
      {
        slug: 'other',
        name: 'Other',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'unknown-app' },
      },
    ];

    const { portals } = await handler.dump(context);

    expect(portals[0].client.client_id).to.equal('Portal App');
    // An application that is not on the tenant keeps its raw id
    expect(portals[1].client.client_id).to.equal('unknown-app');
  });

  it('should fetch clients for the names when clients were not exported', async () => {
    const mgmtClient = mockMgmtClient();
    mgmtClient.clients = {
      list: () => Promise.resolve({ data: [{ name: 'Portal App', client_id: 'abc123' }] }),
    };
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mgmtClient);
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
      },
    ];

    const { portals } = await handler.dump(context);

    expect(portals[0].client.client_id).to.equal('Portal App');
  });

  it('should dump form references by form name, including inside sections', async () => {
    const mgmtClient = mockMgmtClient();
    mgmtClient.forms = {
      list: () => Promise.resolve({ data: [{ id: 'ap_1', name: 'Signup Form' }] }),
    };
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mgmtClient);
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        pages: {
          standard: [
            {
              title: 'Forms',
              slug: 'forms',
              components: [
                {
                  type: 'page:component:auth0:form',
                  config: { form_id: 'ap_1', completion_message: 'Thanks' },
                },
                {
                  type: 'page:component:auth0:structure:section',
                  config: {
                    variant: 'none',
                    children: [
                      {
                        type: 'page:component:auth0:form',
                        config: { form_id: 'ap_1', completion_message: 'Thanks' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    const { portals } = await handler.dump(context);

    const [top, section] = portals[0].pages.standard[0].components;
    expect(top.config.form_id).to.equal('Signup Form');
    expect(section.config.children[0].config.form_id).to.equal('Signup Form');
  });

  it('should not dump portals when they are not available for the tenant', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.portals = null;

    expect(await handler.dump(context)).to.deep.equal({ portals: null });
  });
});
