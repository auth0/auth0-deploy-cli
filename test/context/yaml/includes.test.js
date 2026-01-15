import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML includes cycle detection', () => {
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
    fs.writeFileSync(mainFile, `
tenant:
  friendly_name: Test
  data: !include shared.yaml
rules: !include rules.yaml
`);
    
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

  it('should allow same file included multiple times in different branches', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'multiple-includes');
    cleanThenMkdir(dir);
    
    const mainFile = path.join(dir, 'main.yaml');
    fs.writeFileSync(mainFile, `
tenant:
  friendly_name: Test
  config1: !include shared.yaml
  config2: !include shared.yaml
`);
    
    const sharedFile = path.join(dir, 'shared.yaml');
    fs.writeFileSync(sharedFile, 'shared');

    const config = { AUTH0_INPUT_FILE: mainFile };
    const context = new Context(config, mockMgmtClient());
    
    await context.loadAssetsFromLocal();
    
    expect(context.assets.tenant.friendly_name).to.equal('Test');
    expect(context.assets.tenant.config1).to.equal('shared');
    expect(context.assets.tenant.config2).to.equal('shared');
  });
});