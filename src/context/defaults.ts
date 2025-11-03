import { AttackProtection } from '../tools/auth0/handlers/attackProtection';
import { maskSecretAtPath } from '../tools/utils';

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
    // This is to mask smtp_user to '##SMTP_USER##'
    if (updated.credentials && 'smtp_user' in updated.credentials) {
      delete updated.credentials.smtp_user;
    }
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

  const removeKeysFromOutput = [
    'id',
    'created_at',
    'updated_at',
    'channel',
    'tenant',
    'credentials',
  ];
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

export function connectionDefaults(connection) {
  if (connection.options) {
    // Mask secret for key: connection.options.client_secret
    maskSecretAtPath({
      resourceTypeName: 'connections',
      maskedKeyName: connection.strategy,
      maskOnObj: connection.options,
      keyJsonPath: 'client_secret',
    });
  }
  return connection;
}

export function logStreamDefaults(logStreams) {
  // masked sensitive fields
  const sensitiveKeys = [
    'httpAuthorization',
    'splunkToken',
    'datadogApiKey',
    'mixpanelServiceAccountPassword',
    'segmentWriteKey',
  ];
  const maskedLogStreams = logStreams.map((logStream) => {
    if (logStream.sink) {
      sensitiveKeys.forEach((key) => {
        if (logStream.sink && logStream.sink[key]) {
          maskSecretAtPath({
            resourceTypeName: 'logStreams',
            maskedKeyName: logStream.type,
            maskOnObj: logStream.sink,
            keyJsonPath: key,
          });
        }
      });
    }
    return logStream;
  });

  return maskedLogStreams;
}

export function attackProtectionDefaults(attackProtection: AttackProtection) {
  const { captcha } = attackProtection;

  if (captcha) {
    const providersWithSecrets = ['arkose', 'hcaptcha', 'friendly_captcha', 'recaptcha_v2'];

    providersWithSecrets.forEach((provider) => {
      if (captcha[provider]) {
        captcha[provider] = {
          ...captcha[provider],
          secret: `##CAPTCHA_${provider.toUpperCase()}_SECRET##`,
        };
      }
    });

    if ('recaptcha_enterprise' in captcha) {
      captcha.recaptcha_enterprise = {
        ...captcha.recaptcha_enterprise,
        api_key: '##CAPTCHA_RECAPTCHA_ENTERPRISE_API_KEY##',
        project_id: '##CAPTCHA_RECAPTCHA_ENTERPRISE_PROJECT_ID##',
      };
    }

    attackProtection.captcha = captcha;
  }

  return attackProtection;
}
