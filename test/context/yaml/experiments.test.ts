import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/experiments';
import { mockMgmtClient } from '../../utils';

const sampleExperiment = {
  id: 'exp_1',
  name: 'checkout-test',
  feature_flag_name: 'checkout',
  authentication_flow: 'authentication',
  allocation_strategy: 'percentage',
  status: 'draft',
  allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
};

describe('#YAML context experiments', () => {
  it('should parse experiments', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.experiments = [sampleExperiment] as any;

    const parsed = await handler.parse(context);
    expect(parsed.experiments).to.deep.equal([sampleExperiment]);
  });

  it('should dump experiments', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.experiments = [sampleExperiment] as any;

    const dumped = await handler.dump(context);
    expect(dumped.experiments).to.deep.equal([sampleExperiment]);
  });

  it('should return null when experiments is not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    const dumped = await handler.dump(context);
    expect(dumped.experiments).to.equal(null);
  });
});
