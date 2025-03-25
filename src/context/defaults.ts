// eslint-disable-next-line import/prefer-default-export
export function emailProviderDefaults(emailProvider) {
  // eslint-disable-line
  const updated = { ...emailProvider };

  const apiKeyProviders = ['mailgun', 'mandrill', 'sendgrid', 'sparkpost'];

  // Add placeholder for credentials as they cannot be exported
  const { name } = updated;

  if (apiKeyProviders.includes(name)) {
    updated.credentials = {
      api_key: `##${name.toUpperCase()}_API_KEY##`,
      ...(updated.credentials || {}),
    };
  }

  if (name === 'smtp') {
    updated.credentials = {
      smtp_host: '##SMTP_HOSTNAME##',
      smtp_port: '##SMTP_PORT##',
      smtp_user: '##SMTP_USER##',
      smtp_pass: '##SMTP_PASS##',
      ...(updated.credentials || {}),
    };
  }

  if (name === 'ses') {
    updated.credentials = {
      accessKeyId: '##SES_ACCESS_KEY_ID##',
      secretAccessKey: '##SES_ACCESS_SECRET_KEY##',
      region: '##SES_AWS_REGION##',
      ...(updated.credentials || {}),
    };
  }

  if (name === 'azure_cs') {
    updated.credentials = {
      connectionString: '##AZURE_CS_CONNECTION_KEY##',
      ...(updated.credentials || {}),
    };
  }

  if (name === 'ms365') {
    updated.credentials = {
      tenantId: '##MS365_TENANT_ID##',
      clientId: '##MS365_CLIENT_ID##',
      clientSecret: '##MS365_CLIENT_SECRET##',
      ...(updated.credentials || {}),
    };
  }

  return updated;
}

export function phoneProviderDefaults(phoneProvider) {
  const updated = { ...phoneProvider };

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'channel', 'tenant', 'credentials'];
  removeKeysFromOutput.forEach((key) => {
    if (key in updated) {
      delete updated[key];
    }
  });

  const apiKeyProviders = ['twilio'];

  // Add placeholder for credentials as they cannot be exported
  const { name } = updated;

  if (apiKeyProviders.includes(name)) {
    updated.credentials = {
      auth_token: `##${name.toUpperCase()}_AUTH_TOKEN##`,
    };
  }
  return updated;
}
