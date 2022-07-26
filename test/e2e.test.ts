const { expect } = require('chai');
import zlib from 'zlib';

import nock, { back as nockBack } from 'nock';
const request = require('request');
nockBack.setMode('lockdown');

import { dump } from '../src';

const endpoint = 'https://dog-api.kinduff.com/api/facts';

nockBack.fixtures = __dirname + '/nockFixtures'; //this only needs to be set once in your test helper

const AUTH0_DOMAIN = process.env['AUTH0_E2E_TENANT_DOMAIN'];
const AUTH0_CLIENT_ID = process.env['AUTH0_E2E_CLIENT_ID'];
const AUTH0_CLIENT_SECRET = process.env['AUTH0_E2E_CLIENT_SECRET'];

describe('#end to end', () => {
  it('something', (done) => {
    nockBack('auth0-deploy-cli.json', { afterRecord }, async (nockDone) => {
      await dump({
        output_folder: './local/recorded',
        format: 'yaml',
        config: {
          AUTH0_DOMAIN,
          AUTH0_CLIENT_ID,
          AUTH0_CLIENT_SECRET,
          AUTH0_EXCLUDED: [
            'actions',
            'attackProtection',
            'branding',
            'clientGrants',
            //@ts-ignore
            '_clients',
            'connections',
            'customDomains',
            'databases',
            'emailProvider',
            'emailTemplates',
            'guardianFactorProviders',
            'guardianFactorTemplates',
            'guardianFactors',
            'guardianPhoneFactorMessageTypes',
            'guardianPhoneFactorSelectedProvider',
            'guardianPolicies',
            'hooks',
            'logStreams',
            'migrations',
            'organizations',
            'pages',
            'prompts',
            'resourceServers',
            'roles',
            'rules',
            'rulesConfigs',
            //@ts-ignore
            '_tenant',
            'themes',
            'triggers',
          ],
        },
      }).catch((err) => {
        console.log('Error during dump:', err);
      });

      nockDone();
      done();
    });
  });
});

function decodeBuffer(fixture) {
  try {
    console.log('decode buffer');
    // Decode the hex buffer that nock made
    const response = Array.isArray(fixture.response) ? fixture.response.join('') : fixture.response;

    const decoded = Buffer.from(response, 'hex');
    var unzipped = zlib.gunzipSync(decoded).toString('utf-8');
  } catch (err) {
    console.log({ err });
    throw new Error(`Error decoding nock hex:\n${err}`);
  }

  return JSON.parse(unzipped);
}

function afterRecord(fixtures) {
  console.log('afterRecord', fixtures);
  const normalizedFixtures = fixtures.map((fixture) => {
    fixture.response = decodeBuffer(fixture);

    // do normalization stuff
    // Re-gzip to keep the @octokit/rest happy
    const stringified = JSON.stringify(fixture.response);

    fixture.response = stringified;

    return fixture;
  });

  return normalizedFixtures;
}
