import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/featureFlags';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const sampleFlag = {
  id: 'flg_checkout_123',
  name: 'checkout-experiment',
  description: 'Controls the checkout experience',
  type: 'self',
  status: 'draft',
  parameters: {
    enabled: { type: 'boolean', value: false },
  },
};

describe('#directory context feature flags', () => {
  it('should dump feature flags to the feature-flags directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'featureFlagsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.featureFlags = [sampleFlag] as any;

    await handler.dump(context);

    const featureFlagsDir = path.join(dir, constants.FEATURE_FLAGS_DIRECTORY);
    const dumped = loadJSON(path.join(featureFlagsDir, 'checkout-experiment.json'));

    expect(dumped.name).to.equal('checkout-experiment');
    expect(dumped.parameters.enabled.type).to.equal('boolean');
  });

  it('should parse feature flags from directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'featureFlagsParse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.featureFlags = [sampleFlag] as any;
    await handler.dump(context);

    const parsed = handler.parse(context);
    expect(parsed.featureFlags).to.be.an('array');
    expect(parsed.featureFlags!.length).to.equal(1);
    expect((parsed.featureFlags![0] as any).name).to.equal('checkout-experiment');
  });

  it('should return null when feature-flags directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'featureFlagsEmpty');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const parsed = handler.parse(context);
    expect(parsed.featureFlags).to.equal(null);
  });

  it('should remove stale feature flag files not present in current tenant export', async () => {
    const fs = require('fs-extra');
    const dir = path.join(testDataDir, 'directory', 'featureFlagsStaleCleanup');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const featureFlagsDir = path.join(dir, constants.FEATURE_FLAGS_DIRECTORY);
    fs.ensureDirSync(featureFlagsDir);

    // Pre-seed a stale file representing a previously-exported flag
    fs.writeJsonSync(path.join(featureFlagsDir, 'deleted-flag.json'), {
      name: 'deleted-flag',
      parameters: {},
    });

    context.assets.featureFlags = [sampleFlag] as any;
    await handler.dump(context);

    const remaining = fs.readdirSync(featureFlagsDir);
    expect(remaining).to.include('checkout-experiment.json');
    expect(remaining).to.not.include('deleted-flag.json');
  });
});
