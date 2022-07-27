import { expect } from 'chai';
import zlib from 'zlib';
import path from 'path';
import _ from 'lodash';
import { getFiles, existsMustBeDir } from '../../src/utils';

//Nock Config
import { back as nockBack, Definition } from 'nock';
nockBack.setMode('record');
nockBack.fixtures = __dirname + '/recordings'; //this only needs to be set once in your test helper
type Recording = Definition & { rawHeaders: string[] };

//Application Config
import { dump, deploy } from '../../src';
const AUTH0_DOMAIN = process.env['AUTH0_E2E_TENANT_DOMAIN'];
const AUTH0_CLIENT_ID = process.env['AUTH0_E2E_CLIENT_ID'];
const AUTH0_CLIENT_SECRET = process.env['AUTH0_E2E_CLIENT_SECRET'];

describe('#end-to-end dump', function () {
  it('should dump without throwing an error', async function () {
    const workDirectory = testNameToWorkingDirectory(this?.test?.title);

    const { nockDone } = await nockBack(testNameToFilename(this?.test?.title), {
      afterRecord,
    });

    await dump({
      output_folder: workDirectory,
      format: 'yaml',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
      },
    });

    const files = getFiles(workDirectory, ['.yaml']);

    expect(files).to.have.length(1);
    expect(files[0]).to.equal(path.join(workDirectory, 'tenant.yaml'));
    ['emailTemplates', 'hooks', 'pages', 'rules'].forEach((directory) => {
      expect(existsMustBeDir(path.join(workDirectory, directory))).to.equal(true);
    });

    nockDone();
  });
});

describe('#end-to-end deploy', function () {
  it('should deploy without throwing an error', async function () {
    const { nockDone } = await nockBack(testNameToFilename(this?.test?.title), {
      afterRecord,
    });

    await deploy({
      input_file: `${__dirname}/testdata/should-deploy-without-throwing-an-error/tenant.yaml`, //TODO: perhaps generate automatically based on test name?
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
      },
    });

    nockDone();
  });
});

function decodeBuffer(recordingResponse: Recording['response']) {
  try {
    // Decode the hex buffer that nock made
    const response = Array.isArray(recordingResponse)
      ? recordingResponse.join('')
      : recordingResponse;
    const decoded = Buffer.from(response, 'hex');
    const unzipped = zlib.gunzipSync(decoded).toString('utf-8');
    return JSON.parse(unzipped);
  } catch (err) {
    throw new Error(`Error decoding nock hex:\n${err}`);
  }
}

function afterRecord(recordings) {
  //TODO: apply tighter typing to this function
  return recordings.map((recording) => {
    recording.response = decodeBuffer(recording.response);

    return sanitizeRecording(recording);
  });
}

function testNameToFilename(testName = ''): string {
  if (testName === '') throw new Error('Test name not defined');
  return `${testName.replaceAll(' ', '-')}.json`;
}

function testNameToWorkingDirectory(testName = ''): string {
  const directoryName = testName.replaceAll(' ', '-');
  return path.join('./local/recorded', directoryName);
}

function sanitizeRecording(recording: Recording): Recording {
  //Remove clientID and secret
  const newRecording = recording;

  newRecording.rawHeaders = (() => {
    const newHeaders = _.chunk(recording.rawHeaders, 2)
      .filter((pair) => {
        return pair[0] !== 'Content-Encoding'; // Prevents recordings from becoming gzipped
      })
      .flat();
    return newHeaders;
  })();

  return newRecording;
}
