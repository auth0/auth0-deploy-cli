import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/organizations';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context organizations', () => {
  it('should process organizations', async () => {
    const files = {
      organizations: {
        'acme.json':
          '{ "name": "acme", "display_name": "acme", "branding": { "colors": { "primary": "#3678e2", "page_background": "#9c4949" } }, "connections":[{ "name": "google", "assign_membership_on_login": false, "show_as_button": false }], "client_grants": [], "discovery_domains": [{ "domain": "login.acme.com", "status": "pending", "use_for_organization_discovery": true }]}',
        'contoso.json':
          '{ "name": "contoso", "display_name": "contoso", "branding": { "colors": { "primary": "#3678e2", "page_background": "#9c4949" } }, "connections":[{ "name": "google", "assign_membership_on_login": false, "show_as_button": false }], "client_grants": []}',
        'tast-org.json':
          '{ "name": "atko", "display_name": "Atko", "branding": { "colors": { "primary": "#ededed", "page_background": "#191919" } }, "connections":[{ "name": "Username-Password-Authentication", "assign_membership_on_login": true, "show_as_button": true, "is_signup_enabled": true }], "client_grants": []}',
        'test-org-snow.json':
          '{ "name": "org-snow", "display_name": "snow", "branding": { "colors": { "primary": "#3678e2", "page_background": "#9c4949" } }, "connections":[{ "name": "google", "assign_membership_on_login": false, "show_as_button": false }], "client_grants": [ { "client_id": "Org Snow app" }]}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'orgs2');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        name: 'acme',
        display_name: 'acme',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            name: 'google',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
        client_grants: [],
        discovery_domains: [
          {
            domain: 'login.acme.com',
            status: 'pending',
            use_for_organization_discovery: true,
          },
        ],
      },
      {
        name: 'contoso',
        display_name: 'contoso',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            name: 'google',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
        client_grants: [],
      },
      {
        name: 'atko',
        display_name: 'Atko',
        branding: {
          colors: {
            primary: '#ededed',
            page_background: '#191919',
          },
        },
        connections: [
          {
            name: 'Username-Password-Authentication',
            assign_membership_on_login: true,
            show_as_button: true,
            is_signup_enabled: true,
          },
        ],
        client_grants: [],
      },
      {
        name: 'org-snow',
        display_name: 'snow',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            name: 'google',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
        client_grants: [
          {
            client_id: 'Org Snow app',
          },
        ],
      },
    ];

    expect(context.assets.organizations).to.deep.equal(target);
  });

  it('should ignore objects', async () => {
    const dir = path.join(testDataDir, 'directory', 'organizationsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    // API will return an empty object if there are no organizations
    context.assets.organizations = {};

    await handler.dump(context);

    // folder should not be there
    const organizationsFolder = path.join(dir, 'organizations');
    expect(fs.existsSync(organizationsFolder)).is.equal(false);
  });

  it('should ignore bad organizations directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'orgs3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, 'organizations');
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump organizations', async () => {
    const dir = path.join(testDataDir, 'directory', 'organizationsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.organizations = [
      {
        name: 'acme',
        display_name: 'acme',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            name: 'google',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
        discovery_domains: [
          {
            domain: 'login.acme.com',
            status: 'pending',
            use_for_organization_discovery: true,
            id: 'dd_123',
          },
        ],
      },
      {
        name: 'contoso',
        display_name: 'contoso',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            name: 'google',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
      },
      {
        name: 'atko',
        display_name: 'Atko',
        branding: {
          colors: {
            primary: '#ededed',
            page_background: '#191919',
          },
        },
        connections: [
          {
            name: 'Username-Password-Authentication',
            assign_membership_on_login: true,
            show_as_button: true,
            is_signup_enabled: true,
          },
        ],
      },
    ];

    await handler.dump(context);
    const organizationsFolder = path.join(dir, 'organizations');
    const acmeDump = loadJSON(path.join(organizationsFolder, 'acme.json'));
    const { discovery_domains: dumpedDiscoveryDomains, ...dumpedRest } = acmeDump;
    const { discovery_domains: originalDiscoveryDomains, ...originalRest } =
      context.assets.organizations[0];

    expect(dumpedRest).to.deep.equal(originalRest);
    expect(dumpedDiscoveryDomains).to.deep.equal(
      originalDiscoveryDomains.map(({ domain, status, use_for_organization_discovery }) => ({
        domain,
        status,
        use_for_organization_discovery,
      }))
    );
    expect(loadJSON(path.join(organizationsFolder, 'contoso.json'))).to.deep.equal(
      context.assets.organizations[1]
    );
    expect(loadJSON(path.join(organizationsFolder, 'atko.json'))).to.deep.equal(
      context.assets.organizations[2]
    );
  });
});
