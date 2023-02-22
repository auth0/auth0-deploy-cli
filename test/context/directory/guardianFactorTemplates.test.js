import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianFactorTemplates';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian factors templates provider', () => {
  it('should process guardianFactorTemplates', async () => {
    const guardianFactorTemplatesTest = {
      'sms.json': `{
        "enrollment_message": "test message {{code}}",
        "name": "sms",
        "verification_message": "{{code}} is your verification code for {{tenant.friendly_name}}"
      }`,
    };

    const folder = path.join(constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_TEMPLATES_DIRECTORY);
    const repoDir = path.join(testDataDir, 'directory', 'guardianFactorTemplates');
    createDir(repoDir, { [folder]: guardianFactorTemplatesTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.guardianFactorTemplates).to.deep.equal([
      {
        enrollment_message: 'test message {{code}}',
        name: 'sms',
        verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}',
      },
    ]);
  });

  it('should dump guardian factor templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianFactorTemplatesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianFactorTemplates = [
      {
        enrollment_message: 'test message {{code}}',
        name: 'sms',
        verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}',
      },
    ];

    await handler.dump(context);
    const factorTemplatesFolder = path.join(
      dir,
      constants.GUARDIAN_DIRECTORY,
      constants.GUARDIAN_TEMPLATES_DIRECTORY
    );
    expect(loadJSON(path.join(factorTemplatesFolder, 'sms.json'))).to.deep.equal({
      enrollment_message: 'test message {{code}}',
      name: 'sms',
      verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}',
    });
  });
});
