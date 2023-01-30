import fs from 'fs-extra';
import path from 'path';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

import logger from '../../src/logger';
import { setupContext } from '../../src/context';
import directoryContext from '../../src/context/directory';
import yamlContext from '../../src/context/yaml';
import { cleanThenMkdir, testDataDir } from '../utils';

chai.use(chaiAsPromised);
chai.use(sinonChai);

const config = {
  AUTH0_INPUT_FILE: path.resolve(testDataDir, 'notexist'),
  AUTH0_DOMAIN: 'tenant.auth0.com',
  AUTH0_ACCESS_TOKEN: 'fake',
};

describe('#context loader validation', async () => {
  it('should error on bad file', async () => {
    await expect(setupContext(config)).to.be.eventually.rejectedWith(Error);
  });

  it('should load directory context', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: dir });
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

    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: yaml });
    expect(loaded).to.be.an.instanceof(yamlContext);

    const loaded2 = await setupContext({ ...config, AUTH0_INPUT_FILE: yml });
    expect(loaded2).to.be.an.instanceof(yamlContext);
  });

  it('should include the deploy cli version in the user agent header', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);

    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: yaml });
    expect(loaded).to.be.an.instanceof(yamlContext);

    const userAgent =
      loaded.mgmtClient.rules.resource.restClient.restClient.options.headers['User-agent'];

    expect(userAgent).to.contain('deploy-cli');
    expect(userAgent).to.contain('node.js');
  });

  it('should warn about deprecated exclusion params', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const loggerSpy = sinon.spy(logger, 'warn');
    await setupContext({
      ...config,
      AUTH0_INPUT_FILE: yaml,
      AUTH0_EXCLUDED_CLIENTS: ['connection-1', 'connection-2'],
    });

    expect(loggerSpy).to.have.been.calledWith(
      'Usage of the AUTH0_EXCLUDED_CLIENTS exclusion param is deprecated and may be removed from future major versions. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props for details.'
    );

    loggerSpy.resetHistory(); // Reset history for following case
    await setupContext({ ...config, AUTH0_INPUT_FILE: yaml });
    // eslint-disable-next-line no-unused-expressions
    expect(loggerSpy).to.not.have.been.called;
  });

  it('should error if trying to configure AUTH0_EXCLUDED and AUTH0_INCLUDED_ONLY simultaneously', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    await expect(
      setupContext({
        ...config,
        AUTH0_INPUT_FILE: yaml,
        AUTH0_EXCLUDED: ['actions', 'rules'],
        AUTH0_INCLUDED_ONLY: ['tenant'],
      })
    ).to.be.rejectedWith(
      'Both AUTH0_EXCLUDED and AUTH0_INCLUDED_ONLY configuration values are defined'
    );

    await expect(
      setupContext({
        ...config,
        AUTH0_INCLUDED_ONLY: ['tenant'],
        AUTH0_INPUT_FILE: yaml,
      })
    ).to.be.not.rejected;
  });

  it('should error if trying to define AUTH0_INCLUDED_ONLY as an empty array', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    await expect(
      setupContext({
        ...config,
        AUTH0_INPUT_FILE: yaml,
        AUTH0_INCLUDED_ONLY: [],
      })
    ).to.be.rejectedWith(
      'Need to define at least one resource type in AUTH0_INCLUDED_ONLY configuration.'
    );
  });
});
