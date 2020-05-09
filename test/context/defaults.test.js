import { expect } from 'chai';

import { emailProviderDefaults } from '../../src/context/defaults';


describe('#context defaults', () => {
  describe('emailProvider defaults', () => {
    it('should set emailProvider defaults for smtp', async () => {
      expect(emailProviderDefaults({ name: 'smtp' })).to.deep.equal({
        credentials: {
          smtp_host: '##SMTP_HOSTNAME##',
          smtp_port: '##SMTP_PORT##',
          smtp_user: '##SMTP_USER##',
          smtp_pass: '##SMTP_PASS##'
        },
        name: 'smtp'
      });
    });
  });

  it('should set emailProvider defaults for ses', async () => {
    expect(emailProviderDefaults({ name: 'ses' })).to.deep.equal({
      credentials: {
        accessKeyId: '##SES_ACCESS_KEY_ID##',
        region: '##SES_AWS_REGION##',
        secretAccessKey: '##SES_ACCESS_SECRET_KEY##'
      },
      name: 'ses'
    });
  });

  it('should set emailProvider defaults for mailgun', async () => {
    expect(emailProviderDefaults({ name: 'mailgun' })).to.deep.equal({
      credentials: {
        api_key: '##MAILGUN_API_KEY##'
      },
      name: 'mailgun'
    });
  });

  it('should set emailProvider defaults for mandrill', async () => {
    expect(emailProviderDefaults({ name: 'mandrill' })).to.deep.equal({
      credentials: {
        api_key: '##MANDRILL_API_KEY##'
      },
      name: 'mandrill'
    });
  });

  it('should set emailProvider defaults for sendgrid', async () => {
    expect(emailProviderDefaults({ name: 'sendgrid' })).to.deep.equal({
      credentials: {
        api_key: '##SENDGRID_API_KEY##'
      },
      name: 'sendgrid'
    });
  });

  it('should set emailProvider defaults for sparkpost', async () => {
    expect(emailProviderDefaults({ name: 'sparkpost' })).to.deep.equal({
      credentials: {
        api_key: '##SPARKPOST_API_KEY##'
      },
      name: 'sparkpost'
    });
  });
});
