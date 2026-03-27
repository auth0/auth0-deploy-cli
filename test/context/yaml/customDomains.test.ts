import path from 'path';
import fs from 'fs-extra';
import jsYaml from 'js-yaml';
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
    await context.loadAssetsFromLocal();

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

  it('should write YAML file with sorted keys when AUTH0_EXPORT_ORDERED is true', async () => {
    const dir = path.join(testDataDir, 'yaml', 'custom_domains_sorted');
    cleanThenMkdir(dir);

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, 'customDomains: []\n');

    // Return keys in non-alphabetical order (type, domain, custom_client_ip_header)
    // so we can verify sort actually changes the output order
    const mockClient = {
      customDomains: {
        list: () => [{ type: 'self_managed_certs', domain: 'auth.example.com', custom_client_ip_header: 'cf-connecting-ip' }],
      },
    };

    const context = new Context(
      {
        AUTH0_INPUT_FILE: yamlFile,
        AUTH0_EXPORT_ORDERED: true,
        AUTH0_INCLUDED_ONLY: ['customDomains'],
      } as any,
      mockClient as any
    );

    await context.dump();

    const rawYaml = fs.readFileSync(yamlFile, 'utf8');
    // With sorted keys: custom_client_ip_header < domain < type
    const posCustomClientIpHeader = rawYaml.indexOf('custom_client_ip_header');
    const posDomain = rawYaml.indexOf('domain');
    const posType = rawYaml.indexOf('type');
    expect(posCustomClientIpHeader).to.be.lessThan(posDomain);
    expect(posDomain).to.be.lessThan(posType);

    // Verify YAML is still valid and data is correct
    const parsed = jsYaml.load(rawYaml) as any;
    expect(parsed.customDomains[0]).to.deep.equal({
      type: 'self_managed_certs',
      domain: 'auth.example.com',
      custom_client_ip_header: 'cf-connecting-ip',
    });
  });

});
