import path from 'path';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/flows';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context flows', () => {
  it('should process flows', async () => {
    const files = {
      [constants.FLOWS_DIRECTORY]: {
        'someFlow.json': '{ "name": "someFlow" }',
        'someFlow2.json': '{ "name": "someFlow2" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'flows');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [{ name: 'someFlow' }, { name: 'someFlow2' }];
    expect(context.assets.flows).to.deep.equal(target);
  });

  it('should dump flows', async () => {
    const dir = path.join(testDataDir, 'directory', 'flowsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.flows = [{ name: 'someFlow' }, { name: 'someFlow2' }];

    await handler.dump(context);
    const flowsFolder = path.join(dir, constants.FLOWS_DIRECTORY);
    expect(loadJSON(path.join(flowsFolder, 'someFlow.json'))).to.deep.equal(
      context.assets.flows[0]
    );
    expect(loadJSON(path.join(flowsFolder, 'someFlow2.json'))).to.deep.equal(
      context.assets.flows[1]
    );
  });

  it('should dump flows sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'flowsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.flows = [{ name: 'someFlow' }, { name: 'someFlow2' }];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.FLOWS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'someFlow.json'))).to.deep.equal(
      context.assets.flows[0]
    );
    expect(loadJSON(path.join(clientFolder, 'someFlow2.json'))).to.deep.equal(
      context.assets.flows[1]
    );
  });
});
