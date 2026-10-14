import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/segments';
import { mockMgmtClient } from '../../utils';

const sampleSegment = {
  id: 'seg_gold_123',
  name: 'gold-plan-visitors',
  type: 'self',
  status: 'active',
  rules: [{ match: { country: ['US'] } }],
};

describe('#YAML context segments', () => {
  it('should parse segments', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.segments = [sampleSegment] as any;

    const parsed = await handler.parse(context);
    expect(parsed.segments).to.deep.equal([sampleSegment]);
  });

  it('should dump segments', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.segments = [sampleSegment] as any;

    const dumped = await handler.dump(context);
    expect(dumped.segments).to.deep.equal([sampleSegment]);
  });

  it('should return null when segments is not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    const dumped = await handler.dump(context);
    expect(dumped.segments).to.equal(null);
  });
});
