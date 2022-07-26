import { expect } from 'chai';
import zlib from 'zlib';
import _ from 'lodash';

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
const workingDirectory = './local/recorded';

describe('#end to end tests', function () {
  it('should dump without throwing an error', async function () {
    nockBack(testNameToFilename(this?.test?.title), { afterRecord }, async (nockDone) => {
      await dump({
        output_folder: workingDirectory,
        format: 'yaml',
        config: {
          AUTH0_DOMAIN,
          AUTH0_CLIENT_ID,
          AUTH0_CLIENT_SECRET,
        },
      });

      nockDone();
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

function sanitizeFixture(fixture: Fixture): Fixture {
  //Remove clientID and secret
  const newFixture = fixture;

  newFixture.rawHeaders = (() => {
    if (!fixture.rawHeaders) return fixture.rawHeaders;
    const newHeaders = _.chunk(fixture.rawHeaders, 2)
      .filter((pair) => {
        return pair[0] !== 'Content-Encoding'; // Prevents recordings from becoming gzipped
      })
      .flat();
    return newHeaders;
  })();

  return newFixture;
}
