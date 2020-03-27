import { expect } from 'chai';

import { emailProviderDefaults } from '../../src/context/defaults';


describe('#context defaults', () => {
  describe('emailProvider defaults', () => {
    it('should set emailProvider defaults for smtp', async () => {
      expect(emailProviderDefaults({ name: 'smtp' })).to.deep.equal({
        credentials: {
          smtp_host: 'your.smtp.host.com',
          smtp_port: 25,
          smtp_user: 'YOUR_SMTP_USER',
          smtp_pass: 'YOUR_SMTP_PASS'
        },
        name: 'smtp'
      });
    });
  });

  it('should set emailProvider defaults for ses', async () => {
    expect(emailProviderDefaults({ name: 'ses' })).to.deep.equal({
      credentials: {
        accessKeyId: 'YOUR_ACCESS_KEY_ID',
        region: 'YOUR_SMTP_USER',
        secretAccessKey: 'YOUR_ACCESS_SECRET_KEY'
      },
      name: 'ses'
    });
  });

  it('should set emailProvider defaults for mailgun', async () => {
    expect(emailProviderDefaults({ name: 'mailgun' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_MAILGUN_API_KEY'
      },
      name: 'mailgun'
    });
  });

  it('should set emailProvider defaults for mandrill', async () => {
    expect(emailProviderDefaults({ name: 'mandrill' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_MANDRILL_API_KEY'
      },
      name: 'mandrill'
    });
  });

  it('should set emailProvider defaults for sendgrid', async () => {
    expect(emailProviderDefaults({ name: 'sendgrid' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_SENDGRID_API_KEY'
      },
      name: 'sendgrid'
    });
  });

  it('should set emailProvider defaults for sparkpost', async () => {
    expect(emailProviderDefaults({ name: 'sparkpost' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_SPARKPOST_API_KEY'
      },
      name: 'sparkpost'
    });
  });
});
