import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/portals';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context portals', () => {
  it('should process portals with keyword replacement', async () => {
    const files = {
      [constants.PORTALS_DIRECTORY]: {
        'support.json': `{
          "slug": "support",
          "name": "##PORTAL_NAME##",
          "client": {
            "token_endpoint_auth_method": "client_secret_post",
            "client_id": "abc123",
            "client_secret": "##PORTAL_CLIENT_SECRET##"
          },
          "navigation": { "sidebar": { "components": @@SIDEBAR@@ } }
        }`,
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'portals1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        PORTAL_NAME: 'Support Portal',
        PORTAL_CLIENT_SECRET: 's3cret',
        SIDEBAR: [
          {
            type: 'sidebar:component:auth0:external_link:v2',
            config: { label: 'Docs', href: 'https://example.com' },
          },
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
        navigation: {
          sidebar: {
            components: [
              {
                type: 'sidebar:component:auth0:external_link:v2',
                config: { label: 'Docs', href: 'https://example.com' },
              },
            ],
          },
        },
      },
    ]);
  });

  it('should leave portals unset when the folder is absent', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'portalsAbsent');
    cleanThenMkdir(repoDir);

    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.portals).to.equal(null);
  });

  it('should dump portals named by slug without ids or timestamps', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.portals = [
      {
        id: 'up_8RkL2mNpQ3sT4uV5wX6yZa',
        slug: 'support',
        name: 'Same Name',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-02T00:00:00.000Z',
      },
      { id: 'up_72jbvv7LfRKYp59gtRLtkn', slug: 'partners', name: 'Same Name' },
    ];

    await handler.dump(context);

    const portalsDir = path.join(dir, constants.PORTALS_DIRECTORY);
    expect(fs.readdirSync(portalsDir).sort()).to.deep.equal(['partners.json', 'support.json']);
    expect(loadJSON(path.join(portalsDir, 'support.json'))).to.deep.equal({
      slug: 'support',
      name: 'Same Name',
      client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
    });
  });

  it('should write the client application by name, using the original client ids', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsClientName');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    // clients lose their ids on export; clientsOrig keeps them for name resolution
    context.assets.clients = [{ name: 'Portal App' }];
    context.assets.clientsOrig = [{ name: 'Portal App', client_id: 'abc123' }];
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
      },
    ];

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    expect(loadJSON(file).client.client_id).to.equal('Portal App');
  });

  it('should fetch clients for the names when clients were not exported', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsClientFetch');
    cleanThenMkdir(dir);
    const mgmtClient = mockMgmtClient();
    mgmtClient.clients = {
      list: () => Promise.resolve({ data: [{ name: 'Portal App', client_id: 'abc123' }] }),
    };
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mgmtClient);
    // What the directory context sets when clients are not part of the export
    context.assets.clientsOrig = [];
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
      },
    ];

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    expect(loadJSON(file).client.client_id).to.equal('Portal App');
  });

  it('should keep the raw client_id when clients cannot be listed', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsClientFetchFails');
    cleanThenMkdir(dir);
    const mgmtClient = mockMgmtClient();
    mgmtClient.clients = { list: () => Promise.reject(new Error('Insufficient scope')) };
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mgmtClient);
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        client: { token_endpoint_auth_method: 'client_secret_post', client_id: 'abc123' },
      },
    ];

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    expect(loadJSON(file).client.client_id).to.equal('abc123');
  });

  it('should write form references by form name', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsFormName');
    cleanThenMkdir(dir);
    const mgmtClient = mockMgmtClient();
    mgmtClient.forms = {
      list: () => Promise.resolve({ data: [{ id: 'ap_1', name: 'Signup Form' }] }),
    };
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mgmtClient);
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

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    const [top, section] = loadJSON(file).pages.standard[0].components;
    expect(top.config.form_id).to.equal('Signup Form');
    expect(section.config.children[0].config.form_id).to.equal('Signup Form');
  });

  it('should keep raw form ids when forms cannot be listed', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsFormFetchFails');
    cleanThenMkdir(dir);
    const mgmtClient = mockMgmtClient();
    mgmtClient.forms = { list: () => Promise.reject(new Error('Insufficient scope')) };
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mgmtClient);
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

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    expect(loadJSON(file).pages.standard[0].components[0].config.form_id).to.equal('ap_1');
  });

  it('should remove files of portals that no longer exist on the tenant', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsStale');
    cleanThenMkdir(dir);
    const portalsDir = path.join(dir, constants.PORTALS_DIRECTORY);
    fs.ensureDirSync(portalsDir);
    fs.writeFileSync(path.join(portalsDir, 'deleted-on-tenant.json'), '{"slug":"deleted"}');
    fs.writeFileSync(path.join(portalsDir, 'notes.txt'), 'keep me');

    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.portals = [{ slug: 'support', name: 'Support' }];

    await handler.dump(context);

    expect(fs.readdirSync(portalsDir).sort()).to.deep.equal(['notes.txt', 'support.json']);
  });

  it('should keep files of portals missing from the export when the list limit is reached', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsAtLimit');
    cleanThenMkdir(dir);
    const portalsDir = path.join(dir, constants.PORTALS_DIRECTORY);
    fs.ensureDirSync(portalsDir);
    fs.writeFileSync(
      path.join(portalsDir, 'hidden-by-the-api.json'),
      '{"slug":"hidden-by-the-api"}'
    );

    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.portals = Array.from({ length: constants.PORTALS_LIST_LIMIT }, (_, i) => ({
      slug: `portal-${i}`,
      name: `Portal ${i}`,
    }));

    await handler.dump(context);

    expect(fs.existsSync(path.join(portalsDir, 'hidden-by-the-api.json'))).to.equal(true);
    expect(fs.readdirSync(portalsDir)).to.have.length(constants.PORTALS_LIST_LIMIT + 1);
  });

  it('should never write a client secret', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsNoSecret');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.portals = [
      {
        slug: 'support',
        name: 'Support',
        client: {
          token_endpoint_auth_method: 'client_secret_post',
          client_id: 'abc123',
          client_secret: 'must-not-be-exported',
        },
      },
    ];

    await handler.dump(context);

    const file = path.join(dir, constants.PORTALS_DIRECTORY, 'support.json');
    expect(fs.readFileSync(file, 'utf8')).to.not.include('must-not-be-exported');
  });

  it('should not write anything when portals are not available for the tenant', async () => {
    const dir = path.join(testDataDir, 'directory', 'portalsNone');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    context.assets.portals = null;

    await handler.dump(context);

    expect(fs.existsSync(path.join(dir, constants.PORTALS_DIRECTORY))).to.equal(false);
  });
});
