import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/tenant';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context tenant settings', () => {
  it('should process tenant settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tenant');
    cleanThenMkdir(dir);

    const yaml = `
    tenant:
      friendly_name: 'Auth0 ##ENV##'
      default_directory: "users"
      session_lifetime: 1.48394893
      idle_session_lifetime: 123.4
      flags: {}
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      friendly_name: 'Auth0 test',
      default_directory: 'users',
      session_lifetime: 1.48394893,
      idle_session_lifetime: 123.4,
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal(target);
  });

  it('should process tenant settings that lack session durations', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tenant');
    cleanThenMkdir(dir);

    const yaml = `
    tenant:
      friendly_name: 'Auth0 ##ENV##'
      default_directory: "users"
      flags: {}
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      friendly_name: 'Auth0 test',
      default_directory: 'users',
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal(target);
  });

  it('should dump tenant', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const tenant = {
      friendly_name: 'Auth0 test',
    };
    context.assets.tenant = tenant;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ tenant });
  });

  it('should dump tenant without flags', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const tenant = {
      friendly_name: 'Test',
    };
    context.assets.tenant = {
      friendly_name: 'Test',
      flags: {},
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ tenant });
  });
});
