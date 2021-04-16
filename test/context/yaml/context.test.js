import fs from 'fs-extra';
import jsYaml from 'js-yaml';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context validation', () => {
  it('should do nothing on empty yaml', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal(undefined);
    expect(context.assets.databases).to.deep.equal(undefined);
    expect(context.assets.pages).to.deep.equal(undefined);
    expect(context.assets.clients).to.deep.equal(undefined);
    expect(context.assets.resourceServers).to.deep.equal(undefined);
    expect(context.assets.clientGrants).to.deep.equal(undefined);
    expect(context.assets.connections).to.deep.equal(undefined);
    expect(context.assets.rulesConfigs).to.deep.equal(undefined);
  });

  it('should load excludes', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const config = {
      AUTH0_INPUT_FILE: yaml,
      AUTH0_EXCLUDED_RULES: [ 'rule' ],
      AUTH0_EXCLUDED_CLIENTS: [ 'client' ],
      AUTH0_EXCLUDED_DATABASES: [ 'db' ],
      AUTH0_EXCLUDED_CONNECTIONS: [ 'conn' ],
      AUTH0_EXCLUDED_RESOURCE_SERVERS: [ 'api' ],
      AUTH0_EXCLUDED_DEFAULTS: [ 'emailProvider' ]
    };

    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.exclude.rules).to.deep.equal([ 'rule' ]);
    expect(context.assets.exclude.clients).to.deep.equal([ 'client' ]);
    expect(context.assets.exclude.databases).to.deep.equal([ 'db' ]);
    expect(context.assets.exclude.connections).to.deep.equal([ 'conn' ]);
    expect(context.assets.exclude.resourceServers).to.deep.equal([ 'api' ]);
    expect(context.assets.exclude.defaults).to.deep.equal([ 'emailProvider' ]);
  });

  it('should error invalid schema', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'invalid');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'invalid.yaml');
    fs.writeFileSync(yaml, 'invalid');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.load()).to.be.eventually.rejectedWith(Error);
  });

  it('should error on bad file', async () => {
    const yaml = path.resolve(testDataDir, 'yaml', 'notexist.yml');
    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.load()).to.be.eventually.rejectedWith(Error);
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
    const config = { AUTH0_INPUT_FILE: tenantFile };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.safeLoad(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      branding: {},
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          name: 'Global Client'
        }
      ],
      connections: [],
      databases: [],
      emailProvider: {
        enabled: true,
        name: 'smtp',
        credentials: {
          smtp_host: '##SMTP_HOSTNAME##',
          smtp_pass: '##SMTP_PASS##',
          smtp_port: '##SMTP_PORT##',
          smtp_user: '##SMTP_USER##'
        }
      },
      emailTemplates: [
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account'
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password'
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email'
        },
        {
          body: './emailTemplates/mfa_oob_code.html',
          enabled: true,
          template: 'mfa_oob_code'
        },
        {
          body: './emailTemplates/password_reset.html',
          enabled: true,
          template: 'password_reset'
        },
        {
          body: './emailTemplates/reset_email.html',
          enabled: true,
          template: 'reset_email'
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials'
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation'
        },
        {
          body: './emailTemplates/verify_email.html',
          enabled: true,
          template: 'verify_email'
        },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code'
        },
        {
          body: './emailTemplates/welcome_email.html',
          enabled: true,
          template: 'welcome_email'
        }
      ],
      organizations: [],
      pages: [ { enabled: true, html: './pages/login.html', name: 'login' } ],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      migrations: {},
      guardianPhoneFactorMessageTypes: { message_types: [ 'sms' ] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      prompts: {},
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: [],
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref'
            }
          ]
        }
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test'
      }
    });
  });

  it('should dump tenant.yaml without defaults', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      AUTH0_EXCLUDED_DEFAULTS: [ 'emailProvider' ]
    };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.safeLoad(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      branding: {},
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          name: 'Global Client'
        }
      ],
      connections: [],
      databases: [],
      emailProvider: {
        enabled: true,
        name: 'smtp'
      },
      emailTemplates: [
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account'
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password'
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email'
        },
        {
          body: './emailTemplates/mfa_oob_code.html',
          enabled: true,
          template: 'mfa_oob_code'
        },
        {
          body: './emailTemplates/password_reset.html',
          enabled: true,
          template: 'password_reset'
        },
        {
          body: './emailTemplates/reset_email.html',
          enabled: true,
          template: 'reset_email'
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials'
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation'
        },
        {
          body: './emailTemplates/verify_email.html',
          enabled: true,
          template: 'verify_email'
        },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code'
        },
        {
          body: './emailTemplates/welcome_email.html',
          enabled: true,
          template: 'welcome_email'
        }
      ],
      organizations: [],
      pages: [ { enabled: true, html: './pages/login.html', name: 'login' } ],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      migrations: {},
      guardianPhoneFactorMessageTypes: { message_types: [ 'sms' ] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      prompts: {},
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: [],
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref'
            }
          ]
        }
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test'
      }
    });
  });

  it('should dump tenant.yaml with INCLUDED and EXCLUDED props including defaults', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      INCLUDED_PROPS: { clients: [ 'client_secret' ] },
      EXCLUDED_PROPS: { clients: [ 'name' ], emailProvider: [ 'credentials' ] }
    };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.safeLoad(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      branding: {},
      clientGrants: [],
      clients: [
        {
          custom_login_page: './Global Client_custom_login_page.html',
          custom_login_page_on: true,
          client_secret: 'dummy_client_secret'
        }
      ],
      connections: [],
      databases: [],
      emailProvider: {
        enabled: true,
        name: 'smtp'
      },
      emailTemplates: [
        {
          body: './emailTemplates/blocked_account.html',
          enabled: true,
          template: 'blocked_account'
        },
        {
          body: './emailTemplates/change_password.html',
          enabled: true,
          template: 'change_password'
        },
        {
          body: './emailTemplates/enrollment_email.html',
          enabled: true,
          template: 'enrollment_email'
        },
        {
          body: './emailTemplates/mfa_oob_code.html',
          enabled: true,
          template: 'mfa_oob_code'
        },
        {
          body: './emailTemplates/password_reset.html',
          enabled: true,
          template: 'password_reset'
        },
        {
          body: './emailTemplates/reset_email.html',
          enabled: true,
          template: 'reset_email'
        },
        {
          body: './emailTemplates/stolen_credentials.html',
          enabled: true,
          template: 'stolen_credentials'
        },
        {
          body: './emailTemplates/user_invitation.html',
          enabled: true,
          template: 'user_invitation'
        },
        {
          body: './emailTemplates/verify_email.html',
          enabled: true,
          template: 'verify_email'
        },
        {
          body: './emailTemplates/verify_email_by_code.html',
          enabled: true,
          template: 'verify_email_by_code'
        },
        {
          body: './emailTemplates/welcome_email.html',
          enabled: true,
          template: 'welcome_email'
        }
      ],
      organizations: [],
      pages: [ { enabled: true, html: './pages/login.html', name: 'login' } ],
      guardianFactors: [],
      guardianFactorProviders: [],
      guardianFactorTemplates: [],
      migrations: {},
      guardianPhoneFactorMessageTypes: { message_types: [ 'sms' ] },
      guardianPhoneFactorSelectedProvider: { provider: 'twilio' },
      guardianPolicies: { policies: [] },
      prompts: {},
      resourceServers: [],
      rules: [],
      hooks: [],
      actions: [],
      triggers: [],
      rulesConfigs: [],
      roles: [
        {
          name: 'App Admin',
          description: 'Admin of app',
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref'
            }
          ]
        }
      ],
      tenant: {
        default_directory: 'users',
        friendly_name: 'Test'
      }
    });
  });

  it('should throw error if INCLUDED and EXCLUDED props have intersections', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = {
      AUTH0_INPUT_FILE: tenantFile,
      INCLUDED_PROPS: { clients: [ 'client_secret', 'name' ] },
      EXCLUDED_PROPS: { clients: [ 'client_secret', 'name' ] }
    };
    const context = new Context(config, mockMgmtClient());
    let err;

    try {
      await context.dump();
    } catch (e) {
      err = e.message;
    }

    expect(err).to.equal('EXCLUDED_PROPS should NOT have any intersections with INCLUDED_PROPS. Intersections found: clients: client_secret, name');
  });
});
