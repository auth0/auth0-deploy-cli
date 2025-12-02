import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, cleanThenMkdir, mockMgmtClient } from '../../utils';
import handler from '../../../src/context/directory/handlers/phoneTemplates';
import { loadJSON } from '../../../src/utils';
import fs from 'fs-extra';

describe('#directory context phone templates', () => {
  it('should process phoneTemplates', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'phoneTemplates');
    cleanThenMkdir(repoDir);

    const phoneTemplatesDir = path.join(repoDir, constants.PHONE_TEMPLATES_DIRECTORY);
    cleanThenMkdir(phoneTemplatesDir);

    // Create individual template files
    fs.writeFileSync(
      path.join(phoneTemplatesDir, 'otp_verify.json'),
      JSON.stringify({
        type: 'otp_verify',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: 'Your verification code is {{ code }}',
            voice: 'Your verification code is {{ code }}',
          },
        },
      })
    );

    fs.writeFileSync(
      path.join(phoneTemplatesDir, 'otp_enroll.json'),
      JSON.stringify({
        type: 'otp_enroll',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: 'Your enrollment code is {{ code }}',
          },
        },
      })
    );

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    // Sort by type for consistent comparison since file order is not deterministic
    const sortedTemplates = [...context.assets.phoneTemplates].sort((a, b) =>
      a.type.localeCompare(b.type)
    );

    expect(sortedTemplates).to.deep.equal([
      {
        type: 'otp_enroll',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: 'Your enrollment code is {{ code }}',
          },
        },
      },
      {
        type: 'otp_verify',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: 'Your verification code is {{ code }}',
            voice: 'Your verification code is {{ code }}',
          },
        },
      },
    ]);
  });

  it('should return null when phone-templates directory does not exist', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'phoneTemplatesEmpty');
    cleanThenMkdir(repoDir);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.phoneTemplates).to.equal(null);
  });

  it('should dump phone templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'phoneTemplatesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.phoneTemplates = [
      {
        id: 'pntm_1234567890',
        type: 'otp_verify',
        disabled: false,
        channel: 'sms',
        customizable: true,
        tenant: 'test-tenant',
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Your verification code is {{ code }}',
            voice: 'Your verification code is {{ code }}',
          },
        },
      },
      {
        id: 'pntm_0987654321',
        type: 'otp_enroll',
        disabled: false,
        channel: 'sms',
        customizable: true,
        tenant: 'test-tenant',
        content: {
          syntax: 'liquid',
          from: '+15551234567',
          body: {
            text: 'Your enrollment code is {{ code }}',
          },
        },
      },
    ];

    await handler.dump(context);

    const phoneTemplatesFolder = path.join(dir, constants.PHONE_TEMPLATES_DIRECTORY);

    // Check otp_verify.json - should have read-only fields stripped
    const otpVerify = loadJSON(path.join(phoneTemplatesFolder, 'otp_verify.json'));
    expect(otpVerify).to.deep.equal({
      type: 'otp_verify',
      disabled: false,
      content: {
        syntax: 'liquid',
        from: '+15551234567',
        body: {
          text: 'Your verification code is {{ code }}',
          voice: 'Your verification code is {{ code }}',
        },
      },
    });
    expect(otpVerify).to.not.have.property('id');
    expect(otpVerify).to.not.have.property('channel');
    expect(otpVerify).to.not.have.property('customizable');
    expect(otpVerify).to.not.have.property('tenant');

    // Check otp_enroll.json
    const otpEnroll = loadJSON(path.join(phoneTemplatesFolder, 'otp_enroll.json'));
    expect(otpEnroll).to.deep.equal({
      type: 'otp_enroll',
      disabled: false,
      content: {
        syntax: 'liquid',
        from: '+15551234567',
        body: {
          text: 'Your enrollment code is {{ code }}',
        },
      },
    });
  });

  it('should not dump when phoneTemplates is null', async () => {
    const dir = path.join(testDataDir, 'directory', 'phoneTemplatesNullDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.phoneTemplates = null;

    await handler.dump(context);

    const phoneTemplatesFolder = path.join(dir, constants.PHONE_TEMPLATES_DIRECTORY);
    expect(fs.existsSync(phoneTemplatesFolder)).to.equal(false);
  });
});
