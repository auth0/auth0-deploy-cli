
export function emailProviderDefaults(emailProvider) {  // eslint-disable-line
  const updated = { ...emailProvider };

  const apiKeyProviders = [ 'mandrill', 'sendgrid', 'sparkpost' ];

  // Add placeholder for credentials as they cannot be exported
  const { name } = updated;

  if (apiKeyProviders.includes(name)) {
    updated.credentials = {
      api_key: 'YOUR_API_KEY',
      ...updated.credentials || {}
    };
  }

  if (name === 'smtp') {
    updated.credentials = {
      smtp_host: 'YOUR_SMTP_HOST',
      smtp_port: 'YOUR_SMTP_PORT',
      smtp_user: 'YOUR_SMTP_USER',
      smtp_pass: 'YOUR_SMTP_PASS',
      ...updated.credentials || {}
    };
  }

  if (name === 'ses') {
    updated.credentials = {
      accessKeyId: 'YOUR_ACCESS_KEY_ID',
      secretAccessKey: 'YOUR_ACCESS_SECRET_KEY',
      region: 'YOUR_SMTP_USER',
      ...updated.credentials || {}
    };
  }

  return updated;
}
