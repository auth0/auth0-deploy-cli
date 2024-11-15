import path from 'path';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/forms';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context forms', () => {
  it('should process forms', async () => {
    const files = {
      [constants.FORMS_DIRECTORY]: {
        'someForm.json': '{ "name": "someForm" }',
        'someForm2.json': '{ "name": "someForm2" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'forms');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [{ name: 'someForm' }, { name: 'someForm2' }];
    expect(context.assets.forms).to.deep.equal(target);
  });

  it('should dump forms', async () => {
    const dir = path.join(testDataDir, 'directory', 'formsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.forms = [{ name: 'someForm' }, { name: 'someForm2' }];

    await handler.dump(context);
    const formsFolder = path.join(dir, constants.FORMS_DIRECTORY);
    expect(loadJSON(path.join(formsFolder, 'someForm.json'))).to.deep.equal(
      context.assets.forms[0]
    );
    expect(loadJSON(path.join(formsFolder, 'someForm2.json'))).to.deep.equal(
      context.assets.forms[1]
    );
  });

  it('should dump forms sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'formsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.forms = [{ name: 'someForm' }, { name: 'someForm2' }];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.FORMS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'someForm.json'))).to.deep.equal(
      context.assets.forms[0]
    );
    expect(loadJSON(path.join(clientFolder, 'someForm2.json'))).to.deep.equal(
      context.assets.forms[1]
    );
  });
});
