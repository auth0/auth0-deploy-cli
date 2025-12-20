import path from 'path';
import { ResponseError } from 'auth0';
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

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDx+hc8imR4soBV
9WD9bRey14VqzZfCvEAYbSWctLeZz9xhz+kP+mWxHvv07wi3/ZiYcVYgOYIhxbnt
ugNp78oCFUEsdRrdq2juHlqBtjaYpINQSOqNaKUBt3JRkPPxRLyhwCZ6HJVYy5Wp
4bG6c8eimbglDY4ZwTfUxu1wk3TvMJr9H8tSLwox666NDpxx4ga6kJ06wromShQH
bCS8WlQKI7CpMbnUSrgNJO6QOvu0N97Szl7UwHFVTEuSvDvMGuUPE+Bn4zbrQVSV
Go4oqyTchSR7+9xBpzq36OzXM6zSZqmovJuSzMbCXbBjQlo4s61wvnOLhT3D8Z44
c5VE52frAgMBAAECggEALCx3qXmqNc6AVzDgb+NGfEOT+5dkqQwst0jVoPHswouL
s998sIoJnngFjwVEFjKZdNrb2i4lb3zlIFzg2qoHurGeoDsQmH7+PNoVs7BL7zm5
LyLgjsgXt2SB3hoULmtZ9D1byNcG/JrNy6GEDIGuZCSj1T/QPStkwdc+6VpB8pgW
E8D7jCt40Tik2neYQkDnY775kGAHGWEqpdPCwm+KOnuE1fHx/jk38lmUgYNjKq0h
JK6Ncjen1X+ZsYfGx4dALWG4cqo3lE0YXXuHuvjJV3aVfzH8t7W4fuZ4+8xvdhhV
F4br5FimWLbTe2qT4lSpadkbLm3aBlSUR7eAP0BlwQKBgQD5ayZpP5OMp1zfa4hA
fM8nVUEaVLkRwFK5NChfjHGiaye2RjrnIorXMsFxXjEscgTn2Ux9CgcBhp1fTBhy
6cmhkp1talAIqLBivNQJT0YTfA+uHrHTTyMfEUgsMzPiiAg7FV7BCG6xd/nsk3yg
ZUfoXefrhq9LIHsJx7cK12VViQKBgQD4XKvwYmX5t7fZFBPd7dv5ZrcMHQnBMHd7
is3QhgyKuEgVDzKQ9SA004I9iSvcI3dE/npj31P39N5bbuvYTh4WR/SR4VvXavNG
AqUR7wm8jTlbiWEPgF9MxC24zaa07Kbxs+P8XT/7wWuijf6+baSFgxQMb80fUArv
7guKikCo0wKBgCUn3DIDoZRrfj9eQo7wyN9gKPGmO2e0kd47MeSCBI+gjOrvbWjv
UWWbjwu3b3Xiim6LhYR/EOoeRqViraW4xCvIrqEVHFUd5CDhZmj4oUTXz3It6mnD
OUUwiuLiwdD2WNuMZHA3NF5FtDqVAhTW4a5xBtKkXsq/TPT5BoCb8+GZAoGAUWAD
0gpbgTuJ2G10qPWDaq8V8Lke9haMP4VWNCmHuHfy3juRhN9cAxL+DG2CWmmgbZG3
xjtpRsgLhwfL7J6DyyceYiHltqpLNTgun7ajiQz4qx5TGAImt39bv75aDdOwS2d2
nrxq93EDdEp0Gi7QhhJRolWLbuQKAV0MmQL9dpMCgYEA5+ug3CDI/jyTHG4ZEVoG
qmIg7QoHrVEmZrvCMiFw8bbuBvoMnvu1o1zfvAkNrDfibZyxYKHzSqgeVPQShvLa
P6JCu67ieCGP8C8CMFiQhJ9n4sYGnkzkz67NpkHSzDPA6DfvG4pYuvBQRIefnhYh
IDGpghhKHMV2DAyzeM4cDU8=
-----END PRIVATE KEY-----`;

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

    it.skip('should error while attempting authentication, but pass validation with client secret', async () => {
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'context');
      cleanThenMkdir(dir);

      tmpConfig.AUTH0_CLIENT_SECRET = 'fake secret';

      const result = await expect(
        setupContext({ ...tmpConfig, AUTH0_INPUT_FILE: dir }),
        'import'
      ).to.be.eventually.rejectedWith(ResponseError);

      expect(result).to.be.an('error').that.has.property('statusCode').which.eq(404);
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
        .which.eq('"pkcs8" must be PKCS#8 formatted string');
    });

    it('should error while attempting private key JWT generation because of incorrect value for algorithm, but pass validation with client signing key', async () => {
      // Proves that config value AUTH0_CLIENT_SIGNING_ALGORITHM is being passed to Auth0 library
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'context');
      cleanThenMkdir(dir);
      createDir(dir, {
        '.': {
          'private.pem': TEST_PRIVATE_KEY,
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
        .which.eq(
          'alg bad value for algorithm is not supported either by JOSE or your javascript runtime'
        );
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
