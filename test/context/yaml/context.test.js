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

    expect(context.assets.rules).to.deep.equal([]);
    expect(context.assets.databases).to.deep.equal([]);
    expect(context.assets.pages).to.deep.equal([]);
    expect(context.assets.clients).to.deep.equal([]);
    expect(context.assets.resourceServers).to.deep.equal([]);
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

  it('should dump tenant.yaml', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'dump');
    cleanThenMkdir(dir);
    const tenantFile = path.join(dir, 'tenant.yml');
    const config = { AUTH0_INPUT_FILE: tenantFile };
    const context = new Context(config, mockMgmtClient());
    await context.dump();
    const yaml = jsYaml.safeLoad(fs.readFileSync(tenantFile));
    expect(yaml).to.deep.equal({
      clientGrants: [],
      clients: [
        {
          client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV', custom_login_page: '<html>page</html>', custom_login_page_on: true, name: 'Global Client'
        }
      ],
      connections: [],
      databases: [],
      emailProvider: {},
      emailTemplates: [
        { body: './verify_email.html', enabled: true, template: 'verify_email' },
        { body: './reset_email.html', enabled: true, template: 'reset_email' },
        { body: './welcome_email.html', enabled: true, template: 'welcome_email' },
        { body: './blocked_account.html', enabled: true, template: 'blocked_account' },
        { body: './stolen_credentials.html', enabled: true, template: 'stolen_credentials' },
        { body: './enrollment_email.html', enabled: true, template: 'enrollment_email' },
        { body: './mfa_oob_code.html', enabled: true, template: 'mfa_oob_code' },
        { body: './change_password.html', enabled: true, template: 'change_password' },
        { body: './password_reset.html', enabled: true, template: 'password_reset' }
      ],
      pages: [
        { enabled: true, html: './login.html', name: 'login' }
      ],
      resourceServers: [],
      rules: [],
      rulesConfigs: [],
      tenant: { default_directory: 'users', friendly_name: 'Test' }
    });
  });
});
