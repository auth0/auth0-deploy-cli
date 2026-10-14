import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/variations';
import { mockMgmtClient } from '../../utils';

const sampleVariation = {
  id: 'var_control',
  feature_flag_name: 'checkout',
  name: 'control',
  overrides: {},
};

describe('#YAML context variations', () => {
  it('should parse variations', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.variations = [sampleVariation] as any;

    const parsed = await handler.parse(context);
    expect(parsed.variations).to.deep.equal([sampleVariation]);
  });

  it('should dump variations', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.variations = [sampleVariation] as any;

    const dumped = await handler.dump(context);
    expect(dumped.variations).to.deep.equal([sampleVariation]);
  });

  it('should return null when variations is not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    const dumped = await handler.dump(context);
    expect(dumped.variations).to.equal(null);
  });
});
