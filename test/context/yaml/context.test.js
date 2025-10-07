import path from 'path';
import fs from 'fs-extra';
import jsYaml from 'js-yaml';
import { expect } from 'chai';
import sinon from 'sinon';
import handlers from '../../../src/tools/auth0/handlers';
import Context from '../../../src/context/yaml';
import { cleanThenMkdir, testDataDir, mockMgmtClient, mockPagedData } from '../../utils';
import ScimHandler from '../../../src/tools/auth0/handlers/scimHandler';

describe('#YAML context validation', () => {
  beforeEach(() => {
    sinon.stub(handlers.prompts.default.prototype, 'getCustomPartial').resolves({});
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should do nothing on empty yaml', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.rules).to.deep.equal(null);
    expect(context.assets.databases).to.deep.equal(null);
    expect(context.assets.pages).to.deep.equal(null);
    expect(context.assets.clients).to.deep.equal(null);
    expect(context.assets.resourceServers).to.deep.equal(null);
    expect(context.assets.clientGrants).to.deep.equal(null);
    expect(context.assets.connections).to.deep.equal(null);
    expect(context.assets.rulesConfigs).to.deep.equal(null);
    expect(context.assets.organizations).to.deep.equal(null);
  });

  it('should load excludes', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const config = {
      AUTH0_INPUT_FILE: yaml,
      AUTH0_EXCLUDED_RULES: ['rule'],
      AUTH0_EXCLUDED_CLIENTS: ['client'],
      AUTH0_EXCLUDED_DATABASES: ['db'],
      AUTH0_EXCLUDED_CONNECTIONS: ['conn'],
      AUTH0_EXCLUDED_RESOURCE_SERVERS: ['api'],
      AUTH0_EXCLUDED_DEFAULTS: ['emailProvider'],
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.exclude.rules).to.deep.equal(['rule']);
    expect(context.assets.exclude.clients).to.deep.equal(['client']);
    expect(context.assets.exclude.databases).to.deep.equal(['db']);
    expect(context.assets.exclude.connections).to.deep.equal(['conn']);
    expect(context.assets.exclude.resourceServers).to.deep.equal(['api']);
    expect(context.assets.exclude.defaults).to.deep.equal(['emailProvider']);
  });

  it('should respect resource exclusion on import', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'resource-exclusion');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'resource-exclusion.yaml');
    fs.writeFileSync(
      yaml,
      `
      actions: []
      rules: []
      hooks: []
    `
    );

    const exclusions = ['hooks', 'rules', 'prompts']; // Only actions are defined above but not excluded
    const contextWithExclusion = new Context(
      {
        AUTH0_INPUT_FILE: yaml,
        AUTH0_EXCLUDED: exclusions,
      },
      mockMgmtClient()
    );

    await contextWithExclusion.loadAssetsFromLocal();
    exclusions.forEach((excludedResource) => {
      expect(contextWithExclusion.assets[excludedResource]).to.equal(null); // Ensure all excluded resources, defined or not, are null
    });
    expect(contextWithExclusion.assets.actions).to.deep.equal([]); // Actions were not excluded

    const contextWithoutExclusion = new Context(
      {
        AUTH0_INPUT_FILE: yaml,
        AUTH0_EXCLUDED: [], // Not excluding any resources
      },
      mockMgmtClient()
    );

    await contextWithoutExclusion.loadAssetsFromLocal();
    expect(contextWithoutExclusion.assets.actions).to.deep.equal([]);
    expect(contextWithoutExclusion.assets.hooks).to.deep.equal([]);
    expect(contextWithoutExclusion.assets.rules).to.deep.equal([]);
  });

  it('should respect resource inclusion on import', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'resource-inclusion');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'resource-inclusion.yaml');
    fs.writeFileSync(
      yaml,
      `
      actions: []
      rules: []
      tenant:
        enabled_locales:
          - en
    `
    );

    const contextWithInclusion = new Context(
      {
        AUTH0_INPUT_FILE: yaml,
        AUTH0_INCLUDED_ONLY: ['tenant'],
      },
      mockMgmtClient()
    );

    await contextWithInclusion.loadAssetsFromLocal();
    expect(contextWithInclusion.assets.tenant).to.deep.equal({
      enabled_locales: ['en'],
    });

    expect(contextWithInclusion.assets.actions).to.equal(null);
    expect(contextWithInclusion.assets.rules).to.equal(null);
  });

  it('should error invalid schema', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'invalid');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'invalid.yaml');
    fs.writeFileSync(yaml, 'invalid');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(Error);
  });

  it('should error on bad file', async () => {
    const yaml = path.resolve(testDataDir, 'yaml', 'notexist.yml');
    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(Error);
  });

  it('should load relative file', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'relative1');
    cleanThenMkdir(dir);
    const script = path.join(dir, 'script.js');
    fs.writeFileSync(script, '// empty');

    const config = { AUTH0_INPUT_FILE: '' };
    const context = new Context(config, mockMgmtClient());
    expect(context.loadFile(script.replace(context.basePath, '.'))).to.equal('// empty');
  });

  it('should load full path file', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'relative2');
    cleanThenMkdir(dir);
    const script = path.join(dir, 'script.js');
    fs.writeFileSync(script, '// empty');

    const config = { AUTH0_INPUT_FILE: '' };
    const context = new Context(config, mockMgmtClient());
    expect(context.loadFile(script)).to.equal('// empty');
  });

  it('should dump tenant.yaml with defaults', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const context = new Context({ AUTH0_INPUT_FILE: tenantFile }, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.load(fs.readFileSync(tenantFile));

    expect(yaml).to.deep.equal({
      branding: {
        templates: [],
      },
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          name: 'Global Client',
        },
      ],
      connections: [],
      databases: [],
      phoneProviders: [],
      emailProvider: {
        enabled: true,
        name: 'smtp',
        credentials: {
          smtp_host: '##SMTP_HOSTNAME##',
          smtp_pass: '##SMTP_PASS##',
          smtp_port: '##SMTP_PORT##',
          smtp_user: '##SMTP_USER##',
        },
      },
      emailTemplates: [
        {
          body: './emailTemplates/async_approval.html',
          enabled: true,
          template: 'async_approval',
        },
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account',
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password',
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email',
        },
        { body: './emailTemplates/mfa_oob_code.html', enabled: true, template: 'mfa_oob_code' },
        { body: './emailTemplates/password_reset.html', enabled: true, template: 'password_reset' },
        { body: './emailTemplates/reset_email.html', enabled: true, template: 'reset_email' },
        {
          body: './emailTemplates/reset_email_by_code.html',
          enabled: true,
          template: 'reset_email_by_code',
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials',
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation',
        },
        { body: './emailTemplates/verify_email.html', enabled: true, template: 'verify_email' },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code',
        },
        { body: './emailTemplates/welcome_email.html', enabled: true, template: 'welcome_email' },
      ],
      organizations: [],
      pages: [{ enabled: true, html: './pages/login.html', name: 'login' }],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      guardianPhoneFactorMessageTypes: { message_types: ['sms'] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: {},
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref',
            },
          ],
        },
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test',
        enabled_locales: ['en'],
      },
      attackProtection: {
        breachedPasswordDetection: {},
        bruteForceProtection: {},
        suspiciousIpThrottling: {},
      },
      logStreams: [],
      prompts: {
        customText: {},
        partials: {},
      },
      customDomains: [],
      themes: [],
      flowVaultConnections: [],
      flows: [],
      forms: [],
      selfServiceProfiles: [],
    });
  });

  it('should dump tenant.yaml without defaults', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      AUTH0_EXCLUDED_DEFAULTS: ['emailProvider'],
    };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.load(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      branding: {
        templates: [],
      },
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          name: 'Global Client',
        },
      ],
      connections: [],
      databases: [],
      phoneProviders: [],
      emailProvider: {
        enabled: true,
        name: 'smtp',
      },
      emailTemplates: [
        {
          body: './emailTemplates/async_approval.html',
          enabled: true,
          template: 'async_approval',
        },
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account',
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password',
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email',
        },
        { body: './emailTemplates/mfa_oob_code.html', enabled: true, template: 'mfa_oob_code' },
        { body: './emailTemplates/password_reset.html', enabled: true, template: 'password_reset' },
        { body: './emailTemplates/reset_email.html', enabled: true, template: 'reset_email' },
        {
          body: './emailTemplates/reset_email_by_code.html',
          enabled: true,
          template: 'reset_email_by_code',
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials',
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation',
        },
        { body: './emailTemplates/verify_email.html', enabled: true, template: 'verify_email' },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code',
        },
        { body: './emailTemplates/welcome_email.html', enabled: true, template: 'welcome_email' },
      ],
      organizations: [],
      pages: [{ enabled: true, html: './pages/login.html', name: 'login' }],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      guardianPhoneFactorMessageTypes: { message_types: ['sms'] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: {},
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref',
            },
          ],
        },
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test',
        enabled_locales: ['en'],
      },
      attackProtection: {
        breachedPasswordDetection: {},
        bruteForceProtection: {},
        suspiciousIpThrottling: {},
      },
      logStreams: [],
      prompts: {
        customText: {},
        partials: {},
      },
      customDomains: [],
      themes: [],
      flowVaultConnections: [],
      flows: [],
      forms: [],
      selfServiceProfiles: [],
    });
  });

  it('should dump tenant.yaml with INCLUDED and EXCLUDED props including defaults', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      INCLUDED_PROPS: { clients: ['client_secret'] },
      EXCLUDED_PROPS: { clients: ['name'], emailProvider: ['credentials'] },
    };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.load(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      branding: {
        templates: [],
      },
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          client_secret: 'dummy_client_secret',
        },
      ],
      connections: [],
      databases: [],
      emailProvider: {
        enabled: true,
        name: 'smtp',
      },
      phoneProviders: [],
      emailTemplates: [
        {
          body: './emailTemplates/async_approval.html',
          enabled: true,
          template: 'async_approval',
        },
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account',
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password',
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email',
        },
        { body: './emailTemplates/mfa_oob_code.html', enabled: true, template: 'mfa_oob_code' },
        { body: './emailTemplates/password_reset.html', enabled: true, template: 'password_reset' },
        { body: './emailTemplates/reset_email.html', enabled: true, template: 'reset_email' },
        {
          body: './emailTemplates/reset_email_by_code.html',
          enabled: true,
          template: 'reset_email_by_code',
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials',
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation',
        },
        { body: './emailTemplates/verify_email.html', enabled: true, template: 'verify_email' },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code',
        },
        { body: './emailTemplates/welcome_email.html', enabled: true, template: 'welcome_email' },
      ],
      organizations: [],
      pages: [{ enabled: true, html: './pages/login.html', name: 'login' }],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      guardianPhoneFactorMessageTypes: { message_types: ['sms'] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: {},
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref',
            },
          ],
        },
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test',
        enabled_locales: ['en'],
      },
      attackProtection: {
        breachedPasswordDetection: {},
        bruteForceProtection: {},
        suspiciousIpThrottling: {},
      },
      prompts: {
        customText: {},
        partials: {},
      },
      logStreams: [],
      customDomains: [],
      themes: [],
      flowVaultConnections: [],
      flows: [],
      forms: [],
      selfServiceProfiles: [],
    });
  });

  it('should throw error if INCLUDED and EXCLUDED props have intersections', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      INCLUDED_PROPS: { clients: ['client_secret', 'name'] },
      AUTH0_EXCLUDED: ['prompts'],
      EXCLUDED_PROPS: { clients: ['client_secret', 'name'] },
    };
    const context = new Context(config, mockMgmtClient());
    let err;

    try {
      await context.dump();
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal(
      'EXCLUDED_PROPS should NOT have any intersections with INCLUDED_PROPS. Intersections found: clients: client_secret, name'
    );
  });

  it('should preserve keywords when dumping', async () => {
    const applyScimConfiguration = (connections) => connections;
    sinon.stub(ScimHandler.prototype, 'applyScimConfiguration').returns(applyScimConfiguration);
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');

    const localAssets = `
    tenant:
      friendly_name: "##ENV## Tenant"
      enabled_locales: @@LANGUAGES@@
    connections:
      - name: connection-1
        strategy: waad
        options:
          tenant_domain: "##DOMAIN##"
    `;

    fs.writeFileSync(tenantFile, localAssets);
    const context = new Context(
      {
        AUTH0_INPUT_FILE: tenantFile,
        AUTH0_PRESERVE_KEYWORDS: true,
        AUTH0_INCLUDED_ONLY: ['tenant', 'connections'],
        AUTH0_KEYWORD_REPLACE_MAPPINGS: {
          ENV: 'Production',
          LANGUAGES: ['en', 'es'],
          DOMAIN: 'travel0.com',
        },
      },
      {
        tenants: {
          settings: {
            get: async () =>
              new Promise((resolve) => {
                resolve({
                  friendly_name: 'Production Tenant',
                  enabled_locales: ['en', 'es'],
                });
              }),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                name: 'connection-1',
                strategy: 'waad',
                options: {
                  tenant_domain: 'travel0.com',
                },
              },
            ]),
          _getRestClient: () => ({}),
        },
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
      }
    );
    await context.dump();
    const yaml = jsYaml.load(fs.readFileSync(tenantFile));

    expect(yaml).to.deep.equal({
      tenant: {
        enabled_locales: '@@LANGUAGES@@',
        friendly_name: '##ENV## Tenant',
      },
      connections: [
        {
          name: 'connection-1',
          strategy: 'waad',
          options: {
            tenant_domain: '##DOMAIN##',
          },
        },
      ],
    });
    sinon.restore();
  });
});
