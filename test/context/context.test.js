import path from 'path';
import fs from 'fs-extra';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

import logger from '../../src/logger';
import { setupContext, filterOnlyIncludedResourceTypes } from '../../src/context';
import directoryContext from '../../src/context/directory';
import yamlContext from '../../src/context/yaml';
import { cleanThenMkdir, testDataDir, createDir } from '../utils';

chai.use(chaiAsPromised);
chai.use(sinonChai);

const config = {
  AUTH0_INPUT_FILE: path.resolve(testDataDir, 'notexist'),
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_ACCESS_TOKEN: 'fake',
};

describe('#context loader validation', async () => {
  it('should error on bad file', async () => {
    await expect(setupContext(config), 'import').to.be.eventually.rejectedWith(Error);
  });

  describe('authentication options', async () => {
    let tmpConfig;

    beforeEach(() => {
      tmpConfig = {
        AUTH0_CLIENT_ID: 'fake client ID',
        ...config,
      };
      delete tmpConfig.AUTH0_ACCESS_TOKEN;
    });

    it('should error while attempting private key JWT generation, but pass validation with client signing key', async () => {
      // Proves that config value AUTH0_CLIENT_SIGNING_KEY_PATH is being passed to Auth0 library
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'context');
      cleanThenMkdir(dir);
      createDir(dir, {
        '.': {
          'private.pem': 'some-invalid-private-key',
        },
      });

      tmpConfig.AUTH0_CLIENT_SIGNING_KEY_PATH = path.join(dir, 'private.pem');

      const result = await expect(
        setupContext({ ...tmpConfig, AUTH0_INPUT_FILE: dir }),
        'import'
      ).to.be.eventually.rejectedWith(Error);

      expect(result)
        .to.be.an('Error')
        .that.has.property('message')
        .which.eq('secretOrPrivateKey must be an asymmetric key when using RS256');
    });

    it('should error while attempting private key JWT generation because of incorrect value for algorithm, but pass validation with client signing key', async () => {
      // Proves that config value AUTH0_CLIENT_SIGNING_ALGORITHM is being passed to Auth0 library
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'context');
      cleanThenMkdir(dir);
      createDir(dir, {
        '.': {
          'private.pem': 'some-invalid-private-key',
        },
      });

      tmpConfig.AUTH0_CLIENT_SIGNING_KEY_PATH = path.join(dir, 'private.pem');
      tmpConfig.AUTH0_CLIENT_SIGNING_ALGORITHM = 'bad value for algorithm';

      const result = await expect(
        setupContext({ ...tmpConfig, AUTH0_INPUT_FILE: dir }),
        'import'
      ).to.be.eventually.rejectedWith(Error);

      expect(result)
        .to.be.an('Error')
        .that.has.property('message')
        .which.eq('"algorithm" must be a valid string enum value');
    });

    it('should error when secret, private key and auth token are all absent', async () => {
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'context');
      cleanThenMkdir(dir);

      const result = await expect(
        setupContext({ ...tmpConfig, AUTH0_INPUT_FILE: dir }),
        'import'
      ).to.be.eventually.rejectedWith(Error);

      expect(result)
        .to.be.an('Error')
        .that.has.property('message')
        .which.eq(
          'The following parameters were missing. Please add them to your config.json or as an environment variable. ["AUTH0_CLIENT_SECRET or AUTH0_CLIENT_SIGNING_KEY_PATH or AUTH0_ACCESS_TOKEN"]'
        );
    });
  });

  it('should load directory context', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: dir }, 'import');
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

    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: yaml }, 'import');
    expect(loaded).to.be.an.instanceof(yamlContext);

    const loaded2 = await setupContext({ ...config, AUTH0_INPUT_FILE: yml }, 'import');
    expect(loaded2).to.be.an.instanceof(yamlContext);
  });

  it('should include the deploy cli version in the user agent header', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);

    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    const loaded = await setupContext({ ...config, AUTH0_INPUT_FILE: yaml }, 'import');
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
    await setupContext(
      {
        ...config,
        AUTH0_INPUT_FILE: yaml,
        AUTH0_EXCLUDED_CLIENTS: ['connection-1', 'connection-2'],
      },
      'import'
    );

    expect(loggerSpy).to.have.been.calledWith(
      'Usage of the AUTH0_EXCLUDED_CLIENTS exclusion param is deprecated and may be removed from future major versions. See: https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props for details.'
    );

    loggerSpy.resetHistory(); // Reset history for following case
    await setupContext({ ...config, AUTH0_INPUT_FILE: yaml }, 'import');
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
      setupContext(
        {
          ...config,
          AUTH0_INPUT_FILE: yaml,
          AUTH0_EXCLUDED: ['actions', 'rules'],
          AUTH0_INCLUDED_ONLY: ['tenant'],
        },
        'import'
      )
    ).to.be.rejectedWith(
      'Both AUTH0_EXCLUDED and AUTH0_INCLUDED_ONLY configuration values are defined'
    );

    await expect(
      setupContext(
        {
          ...config,
          AUTH0_INCLUDED_ONLY: ['tenant'],
          AUTH0_INPUT_FILE: yaml,
        },
        'import'
      )
    ).to.be.not.rejected;
  });

  it('should error if trying to define AUTH0_INCLUDED_ONLY as an empty array', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    fs.writeFileSync(yaml, '');

    await expect(
      setupContext(
        {
          ...config,
          AUTH0_INPUT_FILE: yaml,
          AUTH0_INCLUDED_ONLY: [],
        },
        'import'
      )
    ).to.be.rejectedWith(
      'Need to define at least one resource type in AUTH0_INCLUDED_ONLY configuration. See: https://github.com/auth0/auth0-deploy-cli/blob/master/docs/configuring-the-deploy-cli.md#auth0_included_only'
    );
  });
});

describe('#filterOnlyIncludedResourceTypes', async () => {
  it('should filter out all excepted defined in AUTH0_INCLUDED_ONLY', () => {
    const AUTH0_INCLUDED_ONLY = ['hooks', 'actions', 'tenant'];

    expect(
      [['connections'], ['clients'], ['tenant'], ['hooks'], ['actions']].filter(
        filterOnlyIncludedResourceTypes(AUTH0_INCLUDED_ONLY)
      )
    ).to.deep.equal([['tenant'], ['hooks'], ['actions']]);
  });

  it('should filter out nothing if AUTH0_INCLUDED_ONLY is undefined', () => {
    const AUTH0_INCLUDED_ONLY = undefined;

    const all = [['connections'], ['clients'], ['tenant'], ['hooks'], ['actions']];

    expect(all.filter(filterOnlyIncludedResourceTypes(AUTH0_INCLUDED_ONLY))).to.deep.equal(all);
  });

  it('should filter out all if AUTH0_INCLUDED_ONLY is empty', () => {
    const AUTH0_INCLUDED_ONLY = [];

    expect(
      [['connections'], ['clients'], ['tenant'], ['hooks'], ['actions']].filter(
        filterOnlyIncludedResourceTypes(AUTH0_INCLUDED_ONLY)
      )
    ).to.deep.equal([]);
  });
});
