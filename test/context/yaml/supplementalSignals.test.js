import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/supplementalSignals';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context supplementalSignals', () => {
  it('should process supplementalSignals', async () => {
    const dir = path.join(testDataDir, 'yaml', 'supplementalSignals');
    cleanThenMkdir(dir);

    const yaml = `
    supplementalSignals:
      akamai_enabled: true
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      akamai_enabled: true,
    };

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.supplementalSignals).to.deep.equal(target);
  });

  it('should process supplementalSignals with keyword replacement', async () => {
    const dir = path.join(testDataDir, 'yaml', 'supplementalSignals');
    cleanThenMkdir(dir);

    const yaml = `
    supplementalSignals:
      akamai_enabled: ##AKAMAI_ENABLED##
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      akamai_enabled: false,
    };

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { AKAMAI_ENABLED: false },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.supplementalSignals).to.deep.equal(target);
  });

  it('should dump supplementalSignals', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const supplementalSignals = {
      akamai_enabled: true,
    };
    context.assets.supplementalSignals = supplementalSignals;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ supplementalSignals });
  });

  it('should dump supplementalSignals with false value', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const supplementalSignals = {
      akamai_enabled: false,
    };
    context.assets.supplementalSignals = supplementalSignals;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ supplementalSignals });
  });
});
