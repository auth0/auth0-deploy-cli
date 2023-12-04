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
        'breached-password-detection.json':
          '{"enabled": "@@BREACH_PASSWORD_ENABLED@@", "shields": [], "admin_notification_frequency": [], "method": "##BREACH_PASSWORD_PROT_METHOD##"}',
        'brute-force-protection.json':
          '{"enabled": "@@BRUTE_FORCE_PROT_ENABLED@@", "shields": ["block", "user_notification"], "mode": "count_per_identifier_and_ip", "allowlist": [], "max_attempts": 10}',
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
      },
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
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
        'breached-password-detection.json':
          '{"enabled": true, "shields": [], "admin_notification_frequency": [], "method": "standard"}',
        'brute-force-protection.json':
          '{"enabled": true, "shields": ["block", "user_notification"], "mode": "count_per_identifier_and_ip", "allowlist": [], "max_attempts": 10}',
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

    expect(context.assets.attackProtection).to.deep.equal(target);
  });

  it('should dump attack-protection', async () => {
    const dir = path.join(testDataDir, 'directory', 'attackProtectionDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.attackProtection = {
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

    await handler.dump(context);
    const attackProtectionFolder = path.join(dir, 'attack-protection');

    expect(
      loadJSON(path.join(attackProtectionFolder, 'breached-password-detection.json'))
    ).to.deep.equal(context.assets.attackProtection.breachedPasswordDetection);
    expect(
      loadJSON(path.join(attackProtectionFolder, 'brute-force-protection.json'))
    ).to.deep.equal(context.assets.attackProtection.bruteForceProtection);
    expect(
      loadJSON(path.join(attackProtectionFolder, 'suspicious-ip-throttling.json'))
    ).to.deep.equal(context.assets.attackProtection.suspiciousIpThrottling);
  });
});
