import { expect } from 'chai';
import zlib from 'zlib';
import path from 'path';
import _ from 'lodash';
import { getFiles, existsMustBeDir } from '../../src/utils';

//Nock Config
import { back as nockBack, Definition } from 'nock';
nockBack.setMode('record');
nockBack.fixtures = __dirname + '/fixtures'; //this only needs to be set once in your test helper
type Fixture = Definition & { rawHeaders: string[] };

//Application Config
import { dump } from '../../src';
const AUTH0_DOMAIN = process.env['AUTH0_E2E_TENANT_DOMAIN'];
const AUTH0_CLIENT_ID = process.env['AUTH0_E2E_CLIENT_ID'];
const AUTH0_CLIENT_SECRET = process.env['AUTH0_E2E_CLIENT_SECRET'];

describe('#end to end tests', function () {
  it('should dump without throwing an error', async function () {
    const workDirectory = testNameToWorkingDirectory(this?.test?.title);
    nockBack(testNameToFilename(this?.test?.title), { afterRecord }, async (nockDone) => {
      await dump({
        output_folder: workDirectory,
        format: 'yaml',
        config: {
          AUTH0_DOMAIN,
          AUTH0_CLIENT_ID,
          AUTH0_CLIENT_SECRET,
        },
      }).finally(nockDone);
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
  });
});

function decodeBuffer(fixtureResponse: Fixture['response']) {
  try {
    // Decode the hex buffer that nock made
    const response = Array.isArray(fixtureResponse) ? fixtureResponse.join('') : fixtureResponse;
    const decoded = Buffer.from(response, 'hex');
    const unzipped = zlib.gunzipSync(decoded).toString('utf-8');
    return JSON.parse(unzipped);
  } catch (err) {
    throw new Error(`Error decoding nock hex:\n${err}`);
  }
}

function afterRecord(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((fixture) => {
    fixture.response = decodeBuffer(fixture.response);

    return sanitizeFixture(fixture);
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

function sanitizeFixture(fixture: Fixture): Fixture {
  //Remove clientID and secret
  const newFixture = fixture;

  newFixture.rawHeaders = (() => {
    const newHeaders = _.chunk(fixture.rawHeaders, 2)
      .filter((pair) => {
        return pair[0] !== 'Content-Encoding'; // Prevents recordings from becoming gzipped
      })
      .flat();
    return newHeaders;
  })();

  return newFixture;
}
