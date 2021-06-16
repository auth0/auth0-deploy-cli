import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import context from '../../src/context';
import directoryContext from '../../src/context/directory';
import yamlContext from '../../src/context/yaml';
import { cleanThenMkdir, testDataDir } from '../utils';

const config = {
  AUTH0_INPUT_FILE: path.resolve(testDataDir, 'notexist'),
  AUTH0_DOMAIN: 'tenant.auth0.com',
  AUTH0_ACCESS_TOKEN: 'fake'
};

describe('#context loader validation', async () => {
  it('should error on bad file', async () => {
    await expect(context(config)).to.be.eventually.rejectedWith(Error);
  });

  it('should load directory context', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const loaded = await context({ ...config, AUTH0_INPUT_FILE: dir });
    expect(loaded).to.be.an.instanceof(directoryContext);
  });

  it('should load yaml context', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');
    const yml = path.join(dir, 'empty.yml');
    fs.writeFileSync(yml, '');

    const loaded = await context({ ...config, AUTH0_INPUT_FILE: yaml });
    expect(loaded).to.be.an.instanceof(yamlContext);

    const loaded2 = await context({ ...config, AUTH0_INPUT_FILE: yml });
    expect(loaded2).to.be.an.instanceof(yamlContext);
  });

  it('should include the deploy cli version in the user agent header', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);

    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const loaded = await context({ ...config, AUTH0_INPUT_FILE: yaml });
    expect(loaded).to.be.an.instanceof(yamlContext);

    const userAgent = loaded.mgmtClient.rules.resource.restClient.restClient.options.headers['User-agent'];

    expect(userAgent).to.contain('deploy-cli');
    expect(userAgent).to.contain('node.js');
  });
});
