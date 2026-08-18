import path from 'path';
import fs from 'fs-extra';
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
      botDetection:
        bot_detection_level: medium
        monitoring_mode_enabled: true
        allowlist:
          - 10.0.0.1
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
      captcha:
        selected: friendly_captcha
        policy: always
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
      botDetection: {
        allowlist: ['10.0.0.1'],
        bot_detection_level: 'medium',
        monitoring_mode_enabled: true,
      },
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
      captcha: {
        policy: 'always',
        selected: 'friendly_captcha',
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
    await context.loadAssetsFromLocal();
    expect(context.assets.attackProtection).to.deep.equal(target);
  });

  it('should dump attack-protection with primitive arrays sorted deterministically', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './attack-protection.yml' }, mockMgmtClient());
    // Deliberately unsorted input arrays — the dump handler must reorder them.
    context.assets.attackProtection = {
      botDetection: {
        allowlist: ['10.0.0.2', '10.0.0.1'],
        bot_detection_level: 'medium',
        monitoring_mode_enabled: false,
      },
      breachedPasswordDetection: {
        admin_notification_frequency: ['weekly', 'daily', 'immediately'],
        enabled: true,
        method: 'standard',
        shields: ['user_notification', 'block', 'admin_notification'],
      },
      bruteForceProtection: {
        allowlist: [],
        enabled: true,
        max_attempts: 10,
        mode: 'count_per_identifier_and_ip',
        shields: ['user_notification', 'block'],
      },
      captcha: {
        policy: 'always',
        selected: 'friendly_captcha',
      },
      suspiciousIpThrottling: {
        allowlist: ['127.0.0.2', '127.0.0.1'],
        enabled: true,
        shields: ['user_notification', 'admin_notification', 'block'],
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

    const dumped = await handler.dump(context);

    // Concrete expected output, independent of the (mutated) input reference.
    expect(dumped).to.deep.equal({
      attackProtection: {
        botDetection: {
          allowlist: ['10.0.0.1', '10.0.0.2'],
          bot_detection_level: 'medium',
          monitoring_mode_enabled: false,
        },
        breachedPasswordDetection: {
          admin_notification_frequency: ['daily', 'immediately', 'weekly'],
          enabled: true,
          method: 'standard',
          shields: ['admin_notification', 'block', 'user_notification'],
        },
        bruteForceProtection: {
          allowlist: [],
          enabled: true,
          max_attempts: 10,
          mode: 'count_per_identifier_and_ip',
          shields: ['block', 'user_notification'],
        },
        captcha: {
          policy: 'always',
          selected: 'friendly_captcha',
        },
        suspiciousIpThrottling: {
          allowlist: ['127.0.0.1', '127.0.0.2'],
          enabled: true,
          shields: ['admin_notification', 'block', 'user_notification'],
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
      },
    });
  });
});
