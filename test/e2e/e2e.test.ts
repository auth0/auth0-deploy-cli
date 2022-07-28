import { expect } from 'chai';
import path from 'path';
import { getFiles, existsMustBeDir } from '../../src/utils';
import { setupRecording, testNameToWorkingDirectory } from './e2e-utils';
import { dump, deploy } from '../../src';

const shouldUseRecordings = process.env['AUTH0_HTTP_RECORDINGS'] === 'lockdown';
const AUTH0_DOMAIN = shouldUseRecordings
  ? 'deploy-cli-dev.eu.auth0.com'
  : process.env['AUTH0_E2E_TENANT_DOMAIN'] || '';
const AUTH0_CLIENT_ID = process.env['AUTH0_E2E_CLIENT_ID'] || '';
const AUTH0_CLIENT_SECRET = process.env['AUTH0_E2E_CLIENT_SECRET'] || '';
const AUTH0_ACCESS_TOKEN = shouldUseRecordings ? 'insecure' : undefined;

describe('#end-to-end dump', function () {
  it('should dump without throwing an error', async function () {
    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    const { recordingDone } = await setupRecording(this.test?.title);

    await dump({
      output_folder: workDirectory,
      format: 'yaml',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
      },
    });

    const files = getFiles(workDirectory, ['.yaml']);
    expect(files).to.have.length(1);
    expect(files[0]).to.equal(path.join(workDirectory, 'tenant.yaml'));
    ['emailTemplates', 'hooks', 'pages', 'rules'].forEach((dirName) => {
      const directory = path.join(workDirectory, dirName);
      expect(existsMustBeDir(directory)).to.equal(true);
      expect(getFiles(directory, ['.yaml'])).to.have.length(0);
    });

    recordingDone();
  });
});

describe('#end-to-end deploy', function () {
  it('should deploy without throwing an error', async function () {
    const { recordingDone } = await setupRecording(this.test?.title);

    await deploy({
      input_file: `${__dirname}/testdata/should-deploy-without-throwing-an-error/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
      },
    });

    recordingDone();
  });
});

describe('#end-to-end dump and deploy cycle', function () {
  it('should dump and deploy without throwing an error', async function () {
    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    const { recordingDone } = await setupRecording(this.test?.title);

    await dump({
      output_folder: workDirectory,
      format: 'yaml',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
      },
    });

    await deploy({
      input_file: `${workDirectory}/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
      },
    });

    recordingDone();
  });
});
