import { expect } from 'chai';

import cleanAssets from '../src/readonly';

describe('#readonly', function () {
  it('should clear databases of options.configuration', () => {
    const assets = {
      databases: [
        {
          name: 'db1',
          strategy: 'auth0',
          options: {
            configuration: {
              secret: 'i am actually a goose',
            },
            requires_username: true,
          },
        },
      ],
    };
    const target = {
      name: 'db1',
      strategy: 'auth0',
      options: {
        requires_username: true,
      },
    };
    const clear = cleanAssets(assets, {});
    expect(clear.databases).is.deep.equal([target]);
  });

  it('should keep bruteForceProtection.form_submission_mode and clear form_submission_behavior', () => {
    const assets = {
      attackProtection: {
        bruteForceProtection: {
          enabled: true,
          form_submission_mode: 'manual',
          form_submission_behavior: 'auto_submit',
        },
      },
    };
    const clear = cleanAssets(assets, {});
    expect(clear.attackProtection).is.deep.equal({
      bruteForceProtection: {
        enabled: true,
        form_submission_mode: 'manual',
      },
    });
  });
});
