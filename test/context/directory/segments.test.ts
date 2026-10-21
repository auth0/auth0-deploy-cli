import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/segments';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const sampleSegment = {
  id: 'seg_gold_123',
  name: 'gold-plan-visitors',
  description: 'Visitors on the gold plan',
  type: 'self',
  status: 'active',
  rules: [{ match: { country: ['US'] } }],
};

describe('#directory context segments', () => {
  it('should dump segments to the segments directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'segmentsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.segments = [sampleSegment] as any;
    await handler.dump(context);

    const segmentsDir = path.join(dir, constants.SEGMENTS_DIRECTORY);
    const dumped = loadJSON(path.join(segmentsDir, 'gold-plan-visitors.json'));

    expect(dumped.name).to.equal('gold-plan-visitors');
    expect(dumped.rules).to.deep.equal([{ match: { country: ['US'] } }]);
  });

  it('should parse segments from directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'segmentsParse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.segments = [sampleSegment] as any;
    await handler.dump(context);

    const parsed = handler.parse(context);
    expect(parsed.segments).to.be.an('array');
    expect(parsed.segments!.length).to.equal(1);
    expect((parsed.segments![0] as any).name).to.equal('gold-plan-visitors');
  });

  it('should return null when segments directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'segmentsEmpty');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const parsed = handler.parse(context);
    expect(parsed.segments).to.equal(null);
  });

  it('should remove stale segment files not present in current tenant export', async () => {
    const fs = require('fs-extra');
    const dir = path.join(testDataDir, 'directory', 'segmentsStaleCleanup');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const segmentsDir = path.join(dir, constants.SEGMENTS_DIRECTORY);
    fs.ensureDirSync(segmentsDir);
    fs.writeJsonSync(path.join(segmentsDir, 'deleted-segment.json'), {
      name: 'deleted-segment',
      rules: [],
    });

    context.assets.segments = [sampleSegment] as any;
    await handler.dump(context);

    const remaining = fs.readdirSync(segmentsDir);
    expect(remaining).to.include('gold-plan-visitors.json');
    expect(remaining).to.not.include('deleted-segment.json');
  });
});
