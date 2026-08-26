import path from 'path';
import { expect } from 'chai';
import Context from '../../../src/context/directory';
import { cleanThenMkdir, createDir, mockMgmtClient, testDataDir } from '../../utils';
import handler from '../../../src/context/directory/handlers/attackProtection';
import { loadJSON } from '../../../src/utils';

describe('#directory context attack-protection', () => {
  it('should replace keywords', async () => {
    const files = {
      'attack-protection': {
        'bot-detection.json':
          '{"bot_detection_level": "@@BOT_DETECTION_LEVEL@@", "monitoring_mode_enabled": @@BOT_MONITORING_MODE@@, "allowlist": ["@@BOT_ALLOWLIST_ENTRY@@"]}',
        'breached-password-detection.json':
          '{"enabled": "@@BREACH_PASSWORD_ENABLED@@", "shields": [], "admin_notification_frequency": [], "method": "##BREACH_PASSWORD_PROT_METHOD##"}',
        'brute-force-protection.json':
          '{"enabled": "@@BRUTE_FORCE_PROT_ENABLED@@", "shields": ["block", "user_notification"], "mode": "count_per_identifier_and_ip", "allowlist": [], "max_attempts": 10}',
        'captcha.json': '{"selected": "friendly_captcha", "policy": "##CAPTCHA_POLICY##"}',
        'suspicious-ip-throttling.json':
          '{"enabled": true, "shields": ["block", "admin_notification"], "allowlist": ["127.0.0.1"], "stage": {"pre-login": {"max_attempts": 100, "rate": 864000}, "pre-user-registration": {"max_attempts": 50, "rate": 1200}}}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'attackProtection1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        BREACH_PASSWORD_ENABLED: true,
        BREACH_PASSWORD_PROT_METHOD: 'standard',
        BRUTE_FORCE_PROT_ENABLED: false,
        BOT_DETECTION_LEVEL: 'medium',
        BOT_MONITORING_MODE: true,
        BOT_ALLOWLIST_ENTRY: '10.0.0.1',
        CAPTCHA_POLICY: 'always',
      },
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

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
        enabled: false,
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

    expect(context.assets.attackProtection).to.deep.equal(target);
  });

  it('should process attack-protection', async () => {
    const files = {
      'attack-protection': {
        'bot-detection.json':
          '{"bot_detection_level": "medium", "monitoring_mode_enabled": true, "allowlist": ["10.0.0.1"]}',
        'breached-password-detection.json':
          '{"enabled": true, "shields": [], "admin_notification_frequency": [], "method": "standard"}',
        'brute-force-protection.json':
          '{"enabled": true, "shields": ["block", "user_notification"], "mode": "count_per_identifier_and_ip", "allowlist": [], "max_attempts": 10}',
        'captcha.json': '{"selected": "friendly_captcha", "policy": "always"}',
        'suspicious-ip-throttling.json':
          '{"enabled": true, "shields": ["block", "admin_notification"], "allowlist": ["127.0.0.1"], "stage": {"pre-login": {"max_attempts": 100, "rate": 864000}, "pre-user-registration": {"max_attempts": 50, "rate": 1200}}}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'attackProtection1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

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

    expect(context.assets.attackProtection).to.deep.equal(target);
  });

  it('should dump attack-protection with primitive arrays sorted deterministically', async () => {
    const dir = path.join(testDataDir, 'directory', 'attackProtectionDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

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

    await handler.dump(context);
    const attackProtectionFolder = path.join(dir, 'attack-protection');

    // Concrete expected output on disk, independent of the (mutated) input reference.
    expect(loadJSON(path.join(attackProtectionFolder, 'bot-detection.json'))).to.deep.equal({
      allowlist: ['10.0.0.1', '10.0.0.2'],
      bot_detection_level: 'medium',
      monitoring_mode_enabled: false,
    });
    expect(
      loadJSON(path.join(attackProtectionFolder, 'breached-password-detection.json'))
    ).to.deep.equal({
      admin_notification_frequency: ['daily', 'immediately', 'weekly'],
      enabled: true,
      method: 'standard',
      shields: ['admin_notification', 'block', 'user_notification'],
    });
    expect(
      loadJSON(path.join(attackProtectionFolder, 'brute-force-protection.json'))
    ).to.deep.equal({
      allowlist: [],
      enabled: true,
      max_attempts: 10,
      mode: 'count_per_identifier_and_ip',
      shields: ['block', 'user_notification'],
    });
    expect(loadJSON(path.join(attackProtectionFolder, 'captcha.json'))).to.deep.equal({
      policy: 'always',
      selected: 'friendly_captcha',
    });
    expect(
      loadJSON(path.join(attackProtectionFolder, 'suspicious-ip-throttling.json'))
    ).to.deep.equal({
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
    });
  });
});
