import path from 'path';
import { expect } from 'chai';
import { constants } from 'auth0-source-control-extension-tools';

import Context from 'src/context/directory';
import { cleanThenMkdir, testDataDir, writeStringToFile } from 'test/utils';

describe('#context directory pages', () => {
  const createPagesDir = (pagesDir, target) => {
    cleanThenMkdir(pagesDir);
    Object.keys(target).forEach((scriptName) => {
      writeStringToFile(
        path.resolve(pagesDir, scriptName + '.html'),
        target[scriptName].htmlFile
      );
      if (target[scriptName].metadata) {
        writeStringToFile(
          path.resolve(pagesDir, scriptName + '.json'),
          target[scriptName].metadataFile
        );
      }
    });
  };

  it('should process pages', async () => {
    const target = {
      login: {
        htmlFile: '<html>this is login</html>',
        name: 'login'
      },
      guardian_multifactor: {
        htmlFile: '<html>this is guardian</html>',
        metadata: true,
        metadataFile: '{ "enabled": "foo" }',
        name: 'guardian_multifactor'
      },
      password_reset: {
        htmlFile: '<html>this is pwd reset 2: ##val##</html>',
        metadata: true,
        metadataFile: '{ "enabled": false }',
        name: 'password_reset'
      },
      error_page: {
        htmlFile: '<html>this is error page @@jsonVal@@</html>',
        name: 'error_page'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'pages1');
    const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
    createPagesDir(dir, target);

    const context = new Context(repoDir);
    await context.init({
      mappings: {
        val: 'someval',
        jsonVal: [ 'val1', 'val2' ]
      }
    });

    target.password_reset.htmlFile =
      '<html>this is pwd reset 2: someval</html>';
    target.error_page.htmlFile =
      '<html>this is error page ["val1","val2"]</html>';
    expect(context.pages).to.deep.equal(target);
  });

  it('should ignore bad pagename', async () => {
    const target = {
      login: {
        htmlFile: '<html>this is login</html>',
        name: 'login'
      },
      guardian_multifactor2: {
        htmlFile: '<html>this is guardian</html>',
        metadata: true,
        metadataFile: '{ "enabled": "foo" }'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'pages2');
    const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
    createPagesDir(dir, target);
    delete target.guardian_multifactor2;

    const context = new Context(repoDir);
    await context.init();
    expect(context.pages).to.deep.equal(target);
  });

  it('should ignore bad pages directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'pages3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
    writeStringToFile(dir, 'junk');

    const context = new Context(repoDir);
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
