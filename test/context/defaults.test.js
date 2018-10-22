import { expect } from 'chai';

import { emailProviderDefaults } from '../../src/context/defaults';


describe('#context defaults', () => {
  describe('emailProvider defaults', () => {
    it('should set emailProvider defaults for smtp', async () => {
      expect(emailProviderDefaults({ name: 'smtp' })).to.deep.equal({
        credentials: {
          smtp_host: 'YOUR_SMTP_HOST',
          smtp_pass: 'YOUR_SMTP_PASS',
          smtp_port: 'YOUR_SMTP_PORT',
          smtp_user: 'YOUR_SMTP_USER'
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

  it('should set emailProvider defaults for mandrill', async () => {
    expect(emailProviderDefaults({ name: 'mandrill' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_API_KEY'
      },
      name: 'mandrill'
    });
  });

  it('should set emailProvider defaults for sendgrid', async () => {
    expect(emailProviderDefaults({ name: 'sendgrid' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_API_KEY'
      },
      name: 'sendgrid'
    });
  });

  it('should set emailProvider defaults for sparkpost', async () => {
    expect(emailProviderDefaults({ name: 'sparkpost' })).to.deep.equal({
      credentials: {
        api_key: 'YOUR_API_KEY'
      },
      name: 'sparkpost'
    });
  });
});
