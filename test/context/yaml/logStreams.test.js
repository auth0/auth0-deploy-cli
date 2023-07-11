import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/logStreams';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context log streams', () => {
  it('should process log streams', async () => {
    const dir = path.join(testDataDir, 'yaml', 'log_streams');
    cleanThenMkdir(dir);

    const yaml = `
    logStreams:
      - name: Splunk
        sink:
          splunkDomain: test-splunk.com
          splunkPort: '8089'
          splunkToken: 7b838bd0-028e-4d78-a82c-3564a2007770
          splunkSecure: false
        status: active
        type: splunk
      - name: Sumo Logic
        filters: []
        sink:
          sumoSourceAddress: https://api.us2.sumologic.com
        status: active
        type: sumo
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.logStreams).to.deep.equal([
      {
        name: 'Splunk',
        sink: {
          splunkDomain: 'test-splunk.com',
          splunkPort: '8089',
          splunkSecure: false,
          splunkToken: '7b838bd0-028e-4d78-a82c-3564a2007770',
        },
        status: 'active',
        type: 'splunk',
      },
      {
        filters: [],
        name: 'Sumo Logic',
        sink: {
          sumoSourceAddress: 'https://api.us2.sumologic.com',
        },
        status: 'active',
        type: 'sumo',
      },
    ]);
  });

  it('should dump tenant with log streams', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.logStreams = [
      {
        id: 'lst_007',
        name: 'some log stream',
        type: 'http',
        status: 'active',
        sink: {
          httpAuthorization: 'auth-token',
          httpContentFormat: 'JSONLINES',
          httpContentType: 'application/json',
          httpEndpoint: 'https://example.com/test',
        },
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ logStreams: context.assets.logStreams });
  });
});
