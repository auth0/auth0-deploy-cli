import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/customDomains';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context custom domains', () => {
  it('should process custom domains', async () => {
    const dir = path.join(testDataDir, 'yaml', 'custom_domains');
    cleanThenMkdir(dir);

    const yaml = `
    customDomains:
      - custom_client_ip_header: cf-connecting-ip
        domain: auth.test-domain.com
        type: self_managed_certs
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.customDomains).to.deep.equal([
      {
        custom_client_ip_header: 'cf-connecting-ip',
        domain: 'auth.test-domain.com',
        type: 'self_managed_certs',
      },
    ]);
  });

  it('should dump tenant with custom domains', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.customDomains = [
      {
        custom_client_ip_header: 'cf-connecting-ip',
        domain: 'auth.test-domain.com',
        type: 'self_managed_certs',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ customDomains: context.assets.customDomains });
  });
});
