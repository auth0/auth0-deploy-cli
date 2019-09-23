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
  AUTH0_ACCESS_TOKEN: 'fake',
  WEBTASK_API_TOKEN: 'eyJhbGciOiJIUzI1NiIsImtpZCI6InN0LTAifQ.eyJqdGkiOiIxMjM0NSIsImlhdCI6OTk5NDcyNDIxNCwidGVuIjoidGVzdCJ9.rnwU_CxGV2CrlV5c6N0ESvM6W1P-gCWjXLxU9nst-dE',
  WEBTASK_API_URL: 'https://wt.example.com'
};

describe('#context loader validation', async () => {
  it('should error on bad file', async () => {
    expect(async () => context(config).to.throw(Error));
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
});
