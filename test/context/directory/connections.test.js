import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient } from '../../utils';


describe('#directory context connections', () => {
  it('should process a custom connections directory', async () => {
    const customConnectionDirectory = 'connections-custom';

    const files = {
      [customConnectionDirectory]: {
        'a-connection.json': '{ "name": "A Connection" }'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_CONNECTIONS_DIRECTORY: customConnectionDirectory };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      { name: 'A Connection' }
    ];

    expect(context.assets.connections).to.deep.equal(target);
  });
});
