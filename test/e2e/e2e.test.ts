import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { getFiles, existsMustBeDir } from '../../src/utils';
import { load as yamlLoad } from 'js-yaml';
import { setupRecording, testNameToWorkingDirectory } from './e2e-utils';
import { dump, deploy } from '../../src';
import exp from 'constants';
import { AssetTypes } from '../../src/types';

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

  it('should only dump the resources listed in AUTH0_INCLUDED_ONLY', async function () {
    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    const AUTH0_INCLUDED_ONLY = ['actions', 'tenant'] as AssetTypes[];

    const { recordingDone } = await setupRecording(this.test?.title);

    await dump({
      output_folder: workDirectory,
      format: 'yaml',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY,
      },
    });

    const files = getFiles(workDirectory, ['.yaml']);
    expect(files).to.have.length(1);

    const yaml = yamlLoad(fs.readFileSync(files[0]));

    expect(Object.keys(yaml).sort()).to.deep.equal(AUTH0_INCLUDED_ONLY.sort());

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

  it('should deploy without deleting resources if AUTH0_ALLOW_DELETE is false', async function () {
    const { recordingDone } = await setupRecording(this.test?.title);

    // Loading tenant with a good bit of config
    await deploy({
      input_file: `${__dirname}/testdata/lots-of-configuration/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_ALLOW_DELETE: false,
      },
    });

    // Applying configuration to clear tenant out
    await deploy({
      input_file: `${__dirname}/testdata/empty-tenant/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_ALLOW_DELETE: false,
      },
    });

    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    // Perform a subsequent dump to know the new state of remote
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

    const yaml = yamlLoad(fs.readFileSync(files[0]));

    expect(yaml.emailTemplates.length).to.be.above(0);
    expect(yaml.rules.length).to.be.above(0);
    expect(yaml.pages.length).to.be.above(0);
    expect(yaml.clients.length).to.be.above(0);
    expect(yaml.databases.length).to.be.above(0);
    expect(yaml.connections.length).to.be.above(0);
    expect(yaml.roles.length).to.be.above(0);
    expect(yaml.guardianFactorProviders.length).to.be.above(0);
    expect(yaml.guardianFactorTemplates.length).to.be.above(0);
    expect(yaml.actions.length).to.be.above(0);
    expect(yaml.organizations.length).to.be.above(0);
    expect(yaml.logStreams.length).to.be.above(0);

    recordingDone();
  });

  it('should deploy while deleting resources if AUTH0_ALLOW_DELETE is true', async function () {
    const { recordingDone } = await setupRecording(this.test?.title);

    // Loading tenant with a good bit of config
    await deploy({
      input_file: `${__dirname}/testdata/lots-of-configuration/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_ALLOW_DELETE: true,
      },
    });

    // Applying configuration to clear tenant out
    await deploy({
      input_file: `${__dirname}/testdata/empty-tenant/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_ALLOW_DELETE: true,
      },
    });

    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    // Perform a subsequent dump to know the new state of remote
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

    const yaml = yamlLoad(fs.readFileSync(files[0]));

    expect(yaml.rules).to.have.length(0);
    expect(yaml.clients).to.have.length(2); //Accounting for Deploy CLI and Default App client
    expect(yaml.databases).to.have.length(1); // Default user database
    expect(yaml.connections).to.have.length(0);
    expect(yaml.roles).to.have.length(0);
    expect(yaml.actions).to.have.length(0);
    expect(yaml.organizations).to.have.length(0);
    expect(yaml.logStreams).to.have.length(0);

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

describe('#end-to-end keyword replacement', function () {
  it('should deploy yaml config with keyword replacements', async function () {
    const { recordingDone } = await setupRecording(this.test?.title);

    //Resetting tenant to baseline state
    await deploy({
      input_file: `${__dirname}/testdata/keyword-replacements/yaml/_reset.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
      },
    });

    const keywordMapping = {
      COMPANY_NAME: 'Travel0',
      LANGUAGES: ['en', 'es'],
    };

    await deploy({
      input_file: `${__dirname}/testdata/keyword-replacements/yaml/tenant.yaml`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
        AUTH0_KEYWORD_REPLACE_MAPPINGS: keywordMapping,
      },
    });

    const workDirectory = testNameToWorkingDirectory(this.test?.title);
    await dump({
      output_folder: workDirectory,
      format: 'yaml',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
      },
    });

    const files = getFiles(workDirectory, ['.yaml']);
    expect(files).to.have.length(1);
    expect(files[0]).to.equal(path.join(workDirectory, 'tenant.yaml'));

    const yaml = yamlLoad(fs.readFileSync(files[0]));
    expect(yaml.tenant.friendly_name).to.equal(`This is the ${keywordMapping.COMPANY_NAME} Tenant`);
    expect(yaml.tenant.enabled_locales).to.deep.equal(keywordMapping.LANGUAGES);

    recordingDone();
  });

  it('should deploy directory (JSON) config with keyword replacements', async function () {
    const { recordingDone } = await setupRecording(this.test?.title);

    //Resetting tenant to baseline state
    await deploy({
      input_file: `${__dirname}/testdata/keyword-replacements/directory`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
      },
    });

    const keywordMapping = {
      COMPANY_NAME: 'Travel0',
      //LANGUAGES: ['en', 'es'], //TODO: support array replacement for directory format
    };

    await deploy({
      input_file: `${__dirname}/testdata/keyword-replacements/directory`,
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
        AUTH0_KEYWORD_REPLACE_MAPPINGS: keywordMapping,
      },
    });

    const workDirectory = testNameToWorkingDirectory(this.test?.title);
    await dump({
      output_folder: workDirectory,
      format: 'directory',
      config: {
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_ACCESS_TOKEN,
        AUTH0_INCLUDED_ONLY: ['tenant'],
      },
    });

    const files = getFiles(workDirectory, ['.json']);
    expect(files).to.have.length(1);
    expect(files[0]).to.equal(path.join(workDirectory, 'tenant.json'));

    const json = JSON.parse(fs.readFileSync(files[0]).toString());
    expect(json.friendly_name).to.equal(`This is the ${keywordMapping.COMPANY_NAME} Tenant`);

    recordingDone();
  });
});

describe('keyword preservation', () => {
  const config = {
    AUTH0_DOMAIN,
    AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET,
    AUTH0_ACCESS_TOKEN,
    AUTH0_PRESERVE_KEYWORDS: true,
    AUTH0_INCLUDED_ONLY: ['tenant'] as AssetTypes[],
    AUTH0_KEYWORD_REPLACE_MAPPINGS: {
      TENANT_NAME: 'This tenant name should be preserved',
      LANGUAGES: ['en', 'es'],
    },
  };

  it('should preserve keywords for yaml format', async function () {
    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    const { recordingDone } = await setupRecording(this.test?.title);

    await deploy({
      input_file: `${__dirname}/testdata/should-preserve-keywords/yaml/tenant.yaml`,
      config,
    });

    await dump({
      output_folder: `${__dirname}/testdata/should-preserve-keywords/yaml`,
      format: 'yaml',
      config,
    });

    const yaml = yamlLoad(
      fs.readFileSync(`${__dirname}/testdata/should-preserve-keywords/yaml/tenant.yaml`)
    );
    expect(yaml.tenant.friendly_name).to.equal('##TENANT_NAME##');
    // expect(yaml.tenant.enabled_locales).to.equal('@@LANGUAGES@@'); TODO: enable @@ARRAY@@ keyword preservation in yaml formats

    recordingDone();
  });

  it('should preserve keywords for directory format', async function () {
    const workDirectory = testNameToWorkingDirectory(this.test?.title);

    const { recordingDone } = await setupRecording(this.test?.title);

    await deploy({
      input_file: `${__dirname}/testdata/should-preserve-keywords/directory`,
      config,
    });

    await dump({
      output_folder: `${__dirname}/testdata/should-preserve-keywords/directory`,
      format: 'directory',
      config,
    });

    const json = JSON.parse(
      fs
        .readFileSync(`${__dirname}/testdata/should-preserve-keywords/directory/tenant.json`)
        .toString()
    );

    expect(json.friendly_name).to.equal('##TENANT_NAME##');
    expect(json.enabled_locales).to.equal('@@LANGUAGES@@');

    recordingDone();
  });
});
