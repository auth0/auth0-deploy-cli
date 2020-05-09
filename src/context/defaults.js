
export function emailProviderDefaults(emailProvider) {  // eslint-disable-line
  const updated = { ...emailProvider };

  const apiKeyProviders = [ 'mailgun', 'mandrill', 'sendgrid', 'sparkpost' ];

  // Add placeholder for credentials as they cannot be exported
  const { name } = updated;

  if (apiKeyProviders.includes(name)) {
    updated.credentials = {
      api_key: `##${name.toUpperCase()}_API_KEY##`,
      ...updated.credentials || {}
    };
  }

  if (name === 'smtp') {
    updated.credentials = {
      smtp_host: '##SMTP_HOSTNAME##',
      smtp_port: '##SMTP_PORT##',
      smtp_user: '##SMTP_USER##',
      smtp_pass: '##SMTP_PASS##',
      ...updated.credentials || {}
    };
  }

  if (name === 'ses') {
    updated.credentials = {
      accessKeyId: '##SES_ACCESS_KEY_ID##',
      secretAccessKey: '##SES_ACCESS_SECRET_KEY##',
      region: '##SES_AWS_REGION##',
      ...updated.credentials || {}
    };
  }

  return updated;
}
