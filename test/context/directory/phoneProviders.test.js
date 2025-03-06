import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/phoneProvider';
import { loadJSON } from '../../../src/utils';

describe('#directory context phone provider', () => {
  it('should process phoneProviders', async () => {
    const phoneProviderTest = {
      'provider.json': `[
        {
          "name": "twilio",
          "disabled": false,
          "configuration": {
            "sid": "ACc95b2e7e2426f6c6d795680e98c55ab7",
            "default_from": "++15673812247",
            "delivery_methods": [
              "text", "voice"
            ]
          }
        }
       ]`,
    };
    const repoDir = path.join(testDataDir, 'directory', 'phoneProviders');
    createDir(repoDir, { [constants.PHONE_PROVIDER_DIRECTORY]: phoneProviderTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.phoneProviders).to.deep.equal([{
      disabled: false,
      name: 'twilio',
      configuration:{
        sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
        default_from: '++15673812247',
        delivery_methods: ['text', 'voice']
      }
    }]);
  });

  it('should dump phone providers', async () => {
    const dir = path.join(testDataDir, 'directory', 'phoneProviderDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.phoneProviders = [{
      disabled: false,
      name: 'twilio',
      configuration:{
        sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
        default_from: '++15673812247',
        delivery_methods: ['text', 'voice']
      }
    }];

    await handler.dump(context);
    const phoneTemplateFolder = path.join(dir, constants.PHONE_PROVIDER_DIRECTORY);
    expect(loadJSON(path.join(phoneTemplateFolder, 'provider.json'))).to.deep.equal([{
      disabled: false,
      name: 'twilio',
      configuration:{
        sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
        default_from: '++15673812247',
        delivery_methods: ['text', 'voice']
      }
    }]);
  });
});
