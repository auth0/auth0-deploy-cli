import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/attackProtection';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context attack-protection', () => {
  it('should process attack-protection', async () => {
    const dir = path.join(testDataDir, 'yaml', 'attackProtection');
    cleanThenMkdir(dir);

    const yaml = `
    attackProtection:
      breachedPasswordDetection:
        enabled: true
        shields: []
        admin_notification_frequency: []
        method: standard
      bruteForceProtection:
        enabled: true
        shields:
          - block
          - user_notification
        mode: count_per_identifier_and_ip
        allowlist: []
        max_attempts: 10
      suspiciousIpThrottling:
        enabled: true
        shields:
          - block
          - admin_notification
        allowlist:
          - 127.0.0.1
        stage:
          pre-login:
            max_attempts: 100
            rate: 864000
          pre-user-registration:
            max_attempts: 50
            rate: 1200
    `;

    const target = {
      breachedPasswordDetection: {
        admin_notification_frequency: [],
        enabled: true,
        method: 'standard',
        shields: [],
      },
      bruteForceProtection: {
        allowlist: [],
        enabled: true,
        max_attempts: 10,
        mode: 'count_per_identifier_and_ip',
        shields: ['block', 'user_notification'],
      },
      suspiciousIpThrottling: {
        allowlist: ['127.0.0.1'],
        enabled: true,
        shields: ['block', 'admin_notification'],
        stage: {
          'pre-login': {
            max_attempts: 100,
            rate: 864000,
          },
          'pre-user-registration': {
            max_attempts: 50,
            rate: 1200,
          },
        },
      },
    };

    const yamlFile = path.join(dir, 'attack-protection.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.attackProtection).to.deep.equal(target);
  });

  it('should dump attack-protection', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './attack-protection.yml' }, mockMgmtClient());
    const attackProtection = {
      breachedPasswordDetection: {
        admin_notification_frequency: [],
        enabled: true,
        method: 'standard',
        shields: [],
      },
      bruteForceProtection: {
        allowlist: [],
        enabled: true,
        max_attempts: 10,
        mode: 'count_per_identifier_and_ip',
        shields: ['block', 'user_notification'],
      },
      suspiciousIpThrottling: {
        allowlist: ['127.0.0.1'],
        enabled: true,
        shields: ['block', 'admin_notification'],
        stage: {
          'pre-login': {
            max_attempts: 100,
            rate: 864000,
          },
          'pre-user-registration': {
            max_attempts: 50,
            rate: 1200,
          },
        },
      },
    };
    context.assets.attackProtection = attackProtection;

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ attackProtection });
  });
});
