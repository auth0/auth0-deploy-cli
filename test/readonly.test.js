import { expect } from 'chai';

import cleanAssets from '../src/readonly';

describe('#readonly', function() {
  it('should clear databases of options.configuration', () => {
    const assets = {
      databases: [
        {
          name: 'db1',
          strategy: 'auth0',
          options: {
            configuration: {
              secret: 'i am actually a goose'
            },
            requires_username: true
          }
        }
      ]
    };
    const target = {
      name: 'db1',
      strategy: 'auth0',
      options: {
        requires_username: true
      }
    };
    const clear = cleanAssets(assets, {});
    expect(clear.databases).is.deep.equal([ target ]);
  });
});
