import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML includes', () => {
  it('should detect direct circular include', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'circular-direct');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, 'data: !include self.yaml');

    const selfFile = path.join(dir, 'self.yaml');
    fs.writeFileSync(selfFile, 'value: !include self.yaml');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Circular include detected/
    );
  });

  it('should detect indirect circular include (A → B → A)', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'circular-indirect');
    cleanThenMkdir(dir);

    const fileA = path.join(dir, 'a.yaml');
    fs.writeFileSync(fileA, 'data: !include b.yaml');

    const fileB = path.join(dir, 'b.yaml');
    fs.writeFileSync(fileB, 'value: !include a.yaml');

    const config = { AUTH0_INPUT_FILE: fileA };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Circular include detected/
    );
  });

  it('should detect complex circular include (A → B → C → A)', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'circular-complex');
    cleanThenMkdir(dir);

    const fileA = path.join(dir, 'a.yaml');
    fs.writeFileSync(fileA, 'data: !include b.yaml');

    const fileB = path.join(dir, 'b.yaml');
    fs.writeFileSync(fileB, 'value: !include c.yaml');

    const fileC = path.join(dir, 'c.yaml');
    fs.writeFileSync(fileC, 'final: !include a.yaml');

    const config = { AUTH0_INPUT_FILE: fileA };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Circular include detected/
    );
  });

  it('should allow valid includes without cycles', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'valid-includes');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(
      mainFile,
      `
tenant:
  friendly_name: Test
  data: !include shared.yaml
rules: !include rules.yaml
`
    );

    const sharedFile = path.join(dir, 'shared.yaml');
    fs.writeFileSync(sharedFile, 'shared_value: 42');

    const rulesFile = path.join(dir, 'rules.yaml');
    fs.writeFileSync(rulesFile, '[]');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await context.loadAssetsFromLocal();

    expect(context.assets.tenant.friendly_name).to.equal('Test');
    expect(context.assets.tenant.data.shared_value).to.equal(42);
    expect(context.assets.rules).to.deep.equal([]);
  });

  it('should block an include that escapes the config root', async () => {
    const root = path.resolve(testDataDir, 'yaml', 'traversal');
    const dir = path.join(root, 'config');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, 'tenant: !include ../secret.yaml');

    fs.writeFileSync(path.join(root, 'secret.yaml'), 'friendly_name: leaked');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Path traversal blocked/
    );
  });

  it('should block a chained include that escapes the config root', async () => {
    const root = path.resolve(testDataDir, 'yaml', 'traversal-chained');
    const dir = path.join(root, 'config');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, 'tenant: !include nested.yaml');

    // nested.yaml lives inside the root but hops out with `../`.
    fs.writeFileSync(path.join(dir, 'nested.yaml'), 'data: !include ../secret.yaml');
    fs.writeFileSync(path.join(root, 'secret.yaml'), 'friendly_name: leaked');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Path traversal blocked/
    );
  });

  it('should treat a literal __include key as data, not a directive', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'literal-include-key');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, "tenant:\n  friendly_name: Test\n  __include: './not-a-file.yaml'");

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await context.loadAssetsFromLocal();

    expect(context.assets.tenant.__include).to.equal('./not-a-file.yaml');
  });

  it('should not pollute the prototype via a __proto__ key in an include', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'proto-pollution');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, 'tenant: !include evil.yaml');

    const evilFile = path.join(dir, 'evil.yaml');
    fs.writeFileSync(evilFile, '{ "__proto__": { "polluted": true } }');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await context.loadAssetsFromLocal();

    expect({}.polluted).to.equal(undefined);
  });

  it('should allow same file included multiple times in different branches', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'multiple-includes');
    cleanThenMkdir(dir);

    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(
      mainFile,
      `
tenant:
  friendly_name: Test
  config1: !include shared.yaml
  config2: !include shared.yaml
`
    );

    const sharedFile = path.join(dir, 'shared.yaml');
    fs.writeFileSync(sharedFile, 'shared');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await context.loadAssetsFromLocal();

    expect(context.assets.tenant.friendly_name).to.equal('Test');
    expect(context.assets.tenant.config1).to.equal('shared');
    expect(context.assets.tenant.config2).to.equal('shared');
  });

  it('should process a YAML config split with includes', async () => {
    const dir = path.join(testDataDir, 'yaml', 'includes-basic');
    cleanThenMkdir(dir);

    fs.writeFileSync(
      path.join(dir, 'clients.yaml'),
      `
- name: "Test Client"
  app_type: "spa"
- name: "Test M2M"
  app_type: "non_interactive"
    `
    );

    fs.writeFileSync(
      path.join(dir, 'tenant.yaml'),
      `
tenant:
  friendly_name: 'Test Tenant'

clients: !include clients.yaml
    `
    );

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant).to.deep.equal({ friendly_name: 'Test Tenant' });
    expect(context.assets.clients).to.deep.equal([
      { name: 'Test Client', app_type: 'spa' },
      { name: 'Test M2M', app_type: 'non_interactive' },
    ]);
  });

  it('should resolve nested includes (A includes B includes C)', async () => {
    const dir = path.join(testDataDir, 'yaml', 'nested-includes');
    cleanThenMkdir(dir);

    // C: the leaf data.
    fs.writeFileSync(
      path.join(dir, 'clients.yaml'),
      `
- name: My App
  app_type: spa
    `
    );
    // B: a file whose whole body is an include of C.
    fs.writeFileSync(path.join(dir, 'wrapper.yaml'), '!include clients.yaml');
    // A: the entry file includes B.
    fs.writeFileSync(
      path.join(dir, 'tenant.yaml'),
      `
tenant:
  friendly_name: 'Main Tenant'

clients: !include wrapper.yaml
    `
    );

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clients).to.deep.equal([{ name: 'My App', app_type: 'spa' }]);
  });

  it('should apply keyword replacement inside included files', async () => {
    const dir = path.join(testDataDir, 'yaml', 'includes-keywords');
    cleanThenMkdir(dir);

    fs.writeFileSync(
      path.join(dir, 'logStreams.yaml'),
      `
- name: LoggingSAAS
  isPriority: false
  sink:
    httpContentFormat: JSONLINES
    httpContentType: application/json
    httpEndpoint: "##LOGGING_WEBHOOK_URL##"
  type: http
    `
    );

    fs.writeFileSync(
      path.join(dir, 'tenant.yaml'),
      `
tenant:
  friendly_name: 'Test Tenant'

logStreams: !include logStreams.yaml
    `
    );

    const config = {
      AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { LOGGING_WEBHOOK_URL: 'https://logging.com/inputs/test' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.logStreams).to.have.length(1);
    expect(context.assets.logStreams[0].sink.httpEndpoint).to.equal(
      'https://logging.com/inputs/test'
    );
  });

  it('should resolve includes against AUTH0_BASE_PATH when it is set', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'base-path-includes');
    cleanThenMkdir(dir);

    fs.writeFileSync(
      path.join(dir, 'clients.yaml'),
      `
- name: My App
  app_type: spa
    `
    );
    fs.writeFileSync(
      path.join(dir, 'tenant.yaml'),
      `
tenant:
  friendly_name: Test

clients: !include clients.yaml
    `
    );

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml'), AUTH0_BASE_PATH: dir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clients).to.deep.equal([{ name: 'My App', app_type: 'spa' }]);
  });

  it('should reject an absolute include path that escapes the config root', async () => {
    const root = path.resolve(testDataDir, 'yaml', 'absolute-include');
    const dir = path.join(root, 'config');
    cleanThenMkdir(dir);

    const outside = path.join(root, 'secret.yaml');
    fs.writeFileSync(outside, 'friendly_name: leaked');

    const mainFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(mainFile, `tenant: !include ${outside}`);

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Path traversal blocked/
    );
  });

  it('should error on a missing include file', async () => {
    const dir = path.join(testDataDir, 'yaml', 'missing-include');
    cleanThenMkdir(dir);

    fs.writeFileSync(path.join(dir, 'tenant.yaml'), 'clients: !include missing.yaml');

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /Include file not found/
    );
  });

  it('should error when an !include points at a directory', async () => {
    const dir = path.join(testDataDir, 'yaml', 'include-directory');
    cleanThenMkdir(dir);
    cleanThenMkdir(path.join(dir, 'subdir'));

    fs.writeFileSync(path.join(dir, 'tenant.yaml'), 'clients: !include subdir');

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      /is a directory/
    );
  });

  it('should preserve Date values rather than rebuilding them into {}', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'date-preserve');
    cleanThenMkdir(dir);

    // No !include at all: the tree walk must not flatten the Date js-yaml produces.
    fs.writeFileSync(
      path.join(dir, 'tenant.yaml'),
      `
tenant:
  friendly_name: Test
  data:
    launched_at: 2024-01-01
    `
    );

    const config = { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.tenant.data.launched_at).to.be.instanceOf(Date);
    expect(context.assets.tenant.data.launched_at.toISOString()).to.equal(
      '2024-01-01T00:00:00.000Z'
    );
  });
});
