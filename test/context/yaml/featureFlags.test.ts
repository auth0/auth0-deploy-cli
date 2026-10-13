import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/featureFlags';
import { mockMgmtClient } from '../../utils';

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

describe('#YAML context feature flags', () => {
  it('should parse feature flags', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.featureFlags = [sampleFlag] as any;

    const parsed = await handler.parse(context);
    expect(parsed.featureFlags).to.deep.equal([sampleFlag]);
  });

  it('should dump feature flags', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.featureFlags = [sampleFlag] as any;

    const dumped = await handler.dump(context);
    expect(dumped.featureFlags).to.deep.equal([sampleFlag]);
  });

  it('should return null when featureFlags is not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    const dumped = await handler.dump(context);
    expect(dumped.featureFlags).to.equal(null);
  });
});
