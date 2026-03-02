import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/supplementalSignals';
import { loadJSON } from '../../../src/utils';

describe('#directory context supplementalSignals', () => {
  it('should process supplementalSignals', async () => {
    const supplementalSignalsTest = {
      'supplemental-signals.json': `{
        "akamai_enabled": true
      }`,
    };

    const supplementalSignalsTarget = {
      akamai_enabled: true,
    };

    createDir(path.join(testDataDir, 'directory'), {
      supplementalSignals1: supplementalSignalsTest,
    });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'supplementalSignals1'),
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.supplementalSignals).to.deep.equal(supplementalSignalsTarget);
  });

  it('should process supplementalSignals with keyword replacement', async () => {
    const supplementalSignalsTest = {
      'supplemental-signals.json': `{
        "akamai_enabled": ##AKAMAI_ENABLED##
      }`,
    };

    const supplementalSignalsTarget = {
      akamai_enabled: false,
    };

    createDir(path.join(testDataDir, 'directory'), {
      supplementalSignals2: supplementalSignalsTest,
    });

    const config = {
      AUTH0_INPUT_FILE: path.join(testDataDir, 'directory', 'supplementalSignals2'),
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { AKAMAI_ENABLED: false },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.supplementalSignals).to.deep.equal(supplementalSignalsTarget);
  });

  it('should dump supplementalSignals', async () => {
    const dir = path.join(testDataDir, 'directory', 'supplementalSignalsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.supplementalSignals = {
      akamai_enabled: true,
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'supplemental-signals.json'));

    expect(dumped).to.deep.equal(context.assets.supplementalSignals);
  });

  it('should dump supplementalSignals with false value', async () => {
    const dir = path.join(testDataDir, 'directory', 'supplementalSignalsDumpFalse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.supplementalSignals = {
      akamai_enabled: false,
    };

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, 'supplemental-signals.json'));

    expect(dumped).to.deep.equal(context.assets.supplementalSignals);
  });
});
