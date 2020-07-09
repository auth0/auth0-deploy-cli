import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianPolicies';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context guardian policies provider', () => {
  it('should process guardian policies', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianPolicies');
    cleanThenMkdir(dir);

    const yaml = `
      guardianPolicies:
        policies:
          - all-applications
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      policies: [
        'all-applications'
      ]
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianPolicies).to.deep.equal(target);
  });

  it('should support empty guardian policies', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianPolicies');
    cleanThenMkdir(dir);

    const yaml = `
      guardianPolicies:
        policies: []
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      policies: []
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianPolicies).to.deep.equal(target);
  });

  it('should dump guardian policies', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianPolicies = {
      policies: [
        'all-applications'
      ]
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianPolicies: {
        policies: [
          'all-applications'
        ]
      }
    });
  });
});
