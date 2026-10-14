import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/experiments';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const sampleExperiment = {
  id: 'exp_1',
  name: 'checkout-test',
  feature_flag_name: 'checkout',
  authentication_flow: 'authentication',
  allocation_strategy: 'percentage',
  status: 'draft',
  allocations: [
    { variation_name: 'control', is_control: true, weight: 50 },
    { variation_name: 'variant-a', is_control: false, weight: 50 },
  ],
};

describe('#directory context experiments', () => {
  it('should dump experiments to the experiments directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'experimentsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.experiments = [sampleExperiment] as any;
    await handler.dump(context);

    const experimentsDir = path.join(dir, constants.EXPERIMENTS_DIRECTORY);
    const dumped = loadJSON(path.join(experimentsDir, 'checkout-test.json'));

    expect(dumped.name).to.equal('checkout-test');
    expect(dumped.feature_flag_name).to.equal('checkout');
    expect(dumped.allocations[0].variation_name).to.equal('control');
  });

  it('should parse experiments from directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'experimentsParse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.experiments = [sampleExperiment] as any;
    await handler.dump(context);

    const parsed = handler.parse(context);
    expect(parsed.experiments).to.be.an('array');
    expect(parsed.experiments!.length).to.equal(1);
    expect((parsed.experiments![0] as any).name).to.equal('checkout-test');
  });

  it('should return null when experiments directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'experimentsEmpty');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const parsed = handler.parse(context);
    expect(parsed.experiments).to.equal(null);
  });

  it('should remove stale experiment files not present in current tenant export', async () => {
    const fs = require('fs-extra');
    const dir = path.join(testDataDir, 'directory', 'experimentsStaleCleanup');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const experimentsDir = path.join(dir, constants.EXPERIMENTS_DIRECTORY);
    fs.ensureDirSync(experimentsDir);
    fs.writeJsonSync(path.join(experimentsDir, 'deleted-exp.json'), {
      name: 'deleted-exp',
      feature_flag_name: 'checkout',
      authentication_flow: 'authentication',
    });

    context.assets.experiments = [sampleExperiment] as any;
    await handler.dump(context);

    const remaining = fs.readdirSync(experimentsDir);
    expect(remaining).to.include('checkout-test.json');
    expect(remaining).to.not.include('deleted-exp.json');
  });
});
