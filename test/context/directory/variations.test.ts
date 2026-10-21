import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/variations';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const sampleVariation = {
  id: 'var_control',
  feature_flag_name: 'checkout',
  name: 'control',
  description: 'Baseline',
  overrides: {},
};

describe('#directory context variations', () => {
  it('should dump variations scoped by flag name into a per-flag subfolder', async () => {
    const dir = path.join(testDataDir, 'directory', 'variationsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.variations = [sampleVariation] as any;
    await handler.dump(context);

    const variationsDir = path.join(dir, constants.VARIATIONS_DIRECTORY);
    const dumped = loadJSON(path.join(variationsDir, 'checkout', 'control.json'));

    expect(dumped.feature_flag_name).to.equal('checkout');
    expect(dumped.name).to.equal('control');
  });

  it('should not collide when flag+variation names would form the same flat file name', async () => {
    const fs = require('fs-extra');
    const dir = path.join(testDataDir, 'directory', 'variationsCollision');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    // Under a flat "<flag>-<variation>" scheme both of these become "checkout-experiment-control".
    context.assets.variations = [
      { feature_flag_name: 'checkout-experiment', name: 'control', overrides: {} },
      { feature_flag_name: 'checkout', name: 'experiment-control', overrides: {} },
    ] as any;
    await handler.dump(context);

    const variationsDir = path.join(dir, constants.VARIATIONS_DIRECTORY);
    expect(fs.existsSync(path.join(variationsDir, 'checkout-experiment', 'control.json'))).to.equal(
      true
    );
    expect(fs.existsSync(path.join(variationsDir, 'checkout', 'experiment-control.json'))).to.equal(
      true
    );

    // Both survive the round trip rather than one silently overwriting the other.
    const parsed = handler.parse(context);
    expect(parsed.variations!.length).to.equal(2);
  });

  it('should parse variations from directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'variationsParse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.variations = [sampleVariation] as any;
    await handler.dump(context);

    const parsed = handler.parse(context);
    expect(parsed.variations).to.be.an('array');
    expect(parsed.variations!.length).to.equal(1);
    expect((parsed.variations![0] as any).name).to.equal('control');
  });

  it('should return null when variations directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'variationsEmpty');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const parsed = handler.parse(context);
    expect(parsed.variations).to.equal(null);
  });

  it('should remove stale variation files not present in current tenant export', async () => {
    const fs = require('fs-extra');
    const dir = path.join(testDataDir, 'directory', 'variationsStaleCleanup');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const variationsDir = path.join(dir, constants.VARIATIONS_DIRECTORY);
    const checkoutFolder = path.join(variationsDir, 'checkout');
    fs.ensureDirSync(checkoutFolder);
    fs.writeJsonSync(path.join(checkoutFolder, 'deleted.json'), {
      feature_flag_name: 'checkout',
      name: 'deleted',
      overrides: {},
    });

    context.assets.variations = [sampleVariation] as any;
    await handler.dump(context);

    const remaining = fs.readdirSync(checkoutFolder);
    expect(remaining).to.include('control.json');
    expect(remaining).to.not.include('deleted.json');
  });
});
