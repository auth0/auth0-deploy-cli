import path from 'path';
import fs from 'fs-extra';
import jsYaml from 'js-yaml';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/phoneTemplates';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context phone templates', () => {
  it('should process phone templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'phoneTemplates');
    cleanThenMkdir(dir);

    const yaml = `
phoneTemplates:
  - type: otp_verify
    disabled: false
    content:
      from: '+15551234567'
      body:
        text: '##OTP_VERIFICATION_TEXT## {{ code }}'
        voice: '##OTP_VERIFICATION_TEXT## {{ code }}'
  - type: otp_enroll
    disabled: false
    content:
      from: '+15551234567'
      body:
        text: '##OTP_ENROLL_TEXT## {{ code }}'
`;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        type: 'otp_verify',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: '##OTP_VERIFICATION_TEXT## {{ code }}',
            voice: '##OTP_VERIFICATION_TEXT## {{ code }}',
          },
        },
      },
      {
        type: 'otp_enroll',
        disabled: false,
        content: {
          from: '+15551234567',
          body: {
            text: '##OTP_ENROLL_TEXT## {{ code }}',
          },
        },
      },
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.phoneTemplates).to.deep.equal(target);
  });

  it('should dump phone templates', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
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
            text: '##OTP_VERIFICATION_TEXT## {{ code }}',
            voice: '##OTP_VERIFICATION_TEXT## {{ code }}',
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
            text: '##OTP_ENROLL_TEXT## {{ code }}',
          },
        },
      },
    ];

    const dumped = await handler.dump(context);

    // Should have read-only fields stripped
    expect(dumped).to.deep.equal({
      phoneTemplates: [
        {
          type: 'otp_verify',
          disabled: false,
          content: {
            syntax: 'liquid',
            from: '+15551234567',
            body: {
              text: '##OTP_VERIFICATION_TEXT## {{ code }}',
              voice: '##OTP_VERIFICATION_TEXT## {{ code }}',
            },
          },
        },
        {
          type: 'otp_enroll',
          disabled: false,
          content: {
            syntax: 'liquid',
            from: '+15551234567',
            body: {
              text: '##OTP_ENROLL_TEXT## {{ code }}',
            },
          },
        },
      ],
    });

    // Verify read-only fields are stripped
    dumped.phoneTemplates.forEach((template) => {
      expect(template).to.not.have.property('id');
      expect(template).to.not.have.property('channel');
      expect(template).to.not.have.property('customizable');
      expect(template).to.not.have.property('tenant');
    });
  });

  it('should return null when phoneTemplates is not defined', async () => {
    const dir = path.join(testDataDir, 'yaml', 'phoneTemplatesEmpty');
    cleanThenMkdir(dir);

    const yaml = `
clients: []
`;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.phoneTemplates).to.equal(null);
  });

  it('should return null when dumping null phoneTemplates', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.phoneTemplates = null;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ phoneTemplates: null });
  });

  it('should preserve keyword markers when dumping with AUTH0_PRESERVE_KEYWORDS', async () => {
    const dir = path.join(testDataDir, 'yaml', 'phoneTemplatesPreserve');
    cleanThenMkdir(dir);

    const yamlFile = path.join(dir, 'config.yaml');
    const localYaml = `
phoneTemplates:
  - type: otp_verify
    disabled: false
    content:
      from: '##FROM_NUMBER##'
      body:
        text: '##OTP_VERIFICATION_TEXT## {{ code }}'
        voice: '##OTP_VERIFICATION_TEXT## {{ code }}'
`;
    fs.writeFileSync(yamlFile, localYaml);

    const remoteTemplates = [
      {
        id: 'pntm_otp_verify',
        type: 'otp_verify',
        disabled: false,
        content: {
          syntax: 'liquid',
          from: '+15551230000',
          body: {
            text: 'Your verification code is {{ code }}',
            voice: 'Your verification code is {{ code }}',
          },
        },
      },
    ];

    const context = new Context(
      {
        AUTH0_INPUT_FILE: yamlFile,
        AUTH0_PRESERVE_KEYWORDS: true,
        AUTH0_INCLUDED_ONLY: ['phoneTemplates'],
        AUTH0_KEYWORD_REPLACE_MAPPINGS: {
          FROM_NUMBER: '+15551230000',
          OTP_VERIFICATION_TEXT: 'Your verification code is',
        },
      } as any,
      {
        branding: {
          phone: {
            templates: {
              list: () => Promise.resolve({ templates: remoteTemplates }) as any,
            },
          },
        },
      } as any
    );

    await context.dump();

    const dumpedYaml = jsYaml.load(fs.readFileSync(yamlFile, 'utf8'));

    expect(dumpedYaml).to.deep.equal({
      phoneTemplates: [
        {
          type: 'otp_verify',
          disabled: false,
          content: {
            syntax: 'liquid',
            from: '##FROM_NUMBER##',
            body: {
              text: '##OTP_VERIFICATION_TEXT## {{ code }}',
              voice: '##OTP_VERIFICATION_TEXT## {{ code }}',
            },
          },
        },
      ],
    });
  });
});
