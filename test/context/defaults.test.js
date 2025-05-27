import { expect } from 'chai';

import {
  emailProviderDefaults,
  connectionDefaults,
  logStreamDefaults,
} from '../../src/context/defaults';

describe('#context defaults', () => {
  describe('emailProvider defaults', () => {
    it('should set emailProvider defaults for smtp', async () => {
      expect(emailProviderDefaults({ name: 'smtp' })).to.deep.equal({
        credentials: {
          smtp_host: '##SMTP_HOSTNAME##',
          smtp_port: '##SMTP_PORT##',
          smtp_user: '##SMTP_USER##',
          smtp_pass: '##SMTP_PASS##',
        },
        name: 'smtp',
      });
    });

    it('should set emailProvider defaults for smtp and remove existing smtp_user', async () => {
      const emailProvider = {
        name: 'smtp',
        credentials: {
          smtp_user: 'existing_user@example.com',
          smtp_host: 'existing_host',
        },
      };

      const result = emailProviderDefaults(emailProvider);

      expect(result).to.deep.equal({
        credentials: {
          smtp_host: 'existing_host',
          smtp_port: '##SMTP_PORT##',
          smtp_user: '##SMTP_USER##',
          smtp_pass: '##SMTP_PASS##',
        },
        name: 'smtp',
      });
    });
  });

  it('should set emailProvider defaults for ses', async () => {
    expect(emailProviderDefaults({ name: 'ses' })).to.deep.equal({
      credentials: {
        accessKeyId: '##SES_ACCESS_KEY_ID##',
        region: '##SES_AWS_REGION##',
        secretAccessKey: '##SES_ACCESS_SECRET_KEY##',
      },
      name: 'ses',
    });
  });

  it('should set emailProvider defaults for mailgun', async () => {
    expect(emailProviderDefaults({ name: 'mailgun' })).to.deep.equal({
      credentials: {
        api_key: '##MAILGUN_API_KEY##',
      },
      name: 'mailgun',
    });
  });

  it('should set emailProvider defaults for mandrill', async () => {
    expect(emailProviderDefaults({ name: 'mandrill' })).to.deep.equal({
      credentials: {
        api_key: '##MANDRILL_API_KEY##',
      },
      name: 'mandrill',
    });
  });

  it('should set emailProvider defaults for sendgrid', async () => {
    expect(emailProviderDefaults({ name: 'sendgrid' })).to.deep.equal({
      credentials: {
        api_key: '##SENDGRID_API_KEY##',
      },
      name: 'sendgrid',
    });
  });

  it('should set emailProvider defaults for sparkpost', async () => {
    expect(emailProviderDefaults({ name: 'sparkpost' })).to.deep.equal({
      credentials: {
        api_key: '##SPARKPOST_API_KEY##',
      },
      name: 'sparkpost',
    });
  });

  describe('connectionDefaults', () => {
    it('should mask client_secret in connection options', () => {
      const connection = {
        name: 'Test Connection',
        strategy: 'oauth2',
        options: {
          client_id: 'test_client_id',
          client_secret: 'sensitive_secret_value',
          scope: ['openid', 'profile'],
        },
      };

      const result = connectionDefaults(connection);

      expect(result.options.client_secret).to.equal('##CONNECTIONS_OAUTH2_SECRET##');
      expect(result.options.client_id).to.equal('test_client_id');
      expect(result.options.scope).to.deep.equal(['openid', 'profile']);
    });

    it('should handle connection without options', () => {
      const connection = {
        name: 'Test Connection',
        strategy: 'oauth2',
      };

      const result = connectionDefaults(connection);

      expect(result).to.deep.equal(connection);
    });

    it('should handle connection with options but no client_secret', () => {
      const connection = {
        name: 'Test Connection',
        strategy: 'samlp',
        options: {
          client_id: 'test_client_id',
          scope: ['openid'],
        },
      };

      const result = connectionDefaults(connection);

      expect(result).to.deep.equal(connection);
    });

    it('should mask client_secret for different strategies', () => {
      const connection = {
        name: 'SAML Connection',
        strategy: 'samlp',
        options: {
          client_secret: 'another_secret',
        },
      };

      const result = connectionDefaults(connection);

      expect(result.options.client_secret).to.equal('##CONNECTIONS_SAMLP_SECRET##');
    });

    it('should handle strategy names with special characters', () => {
      const connection = {
        name: 'Custom Connection',
        strategy: 'custom-oauth-2.0',
        options: {
          client_secret: 'secret_value',
        },
      };

      const result = connectionDefaults(connection);

      expect(result.options.client_secret).to.equal('##CONNECTIONS_CUSTOM_OAUTH_2_0_SECRET##');
    });
  });

  describe('logStreamDefaults', () => {
    it('should mask httpAuthorization in log stream sink', () => {
      const logStreams = [
        {
          name: 'Test HTTP Stream',
          type: 'http',
          sink: {
            httpEndpoint: 'https://example.com/logs',
            httpAuthorization: 'Bearer secret_token',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.httpAuthorization).to.equal('##LOGSTREAMS_HTTP_SECRET##');
      expect(result[0].sink.httpEndpoint).to.equal('https://example.com/logs');
    });

    it('should mask splunkToken in log stream sink', () => {
      const logStreams = [
        {
          name: 'Splunk Stream',
          type: 'splunk',
          sink: {
            splunkDomain: 'mycompany.splunkcloud.com',
            splunkToken: 'secret_splunk_token',
            splunkPort: '8088',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.splunkToken).to.equal('##LOGSTREAMS_SPLUNK_SECRET##');
      expect(result[0].sink.splunkDomain).to.equal('mycompany.splunkcloud.com');
      expect(result[0].sink.splunkPort).to.equal('8088');
    });

    it('should mask datadogApiKey in log stream sink', () => {
      const logStreams = [
        {
          name: 'Datadog Stream',
          type: 'datadog',
          sink: {
            datadogRegion: 'us',
            datadogApiKey: 'secret_datadog_key',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.datadogApiKey).to.equal('##LOGSTREAMS_DATADOG_SECRET##');
      expect(result[0].sink.datadogRegion).to.equal('us');
    });

    it('should mask mixpanelServiceAccountPassword in log stream sink', () => {
      const logStreams = [
        {
          name: 'Mixpanel Stream',
          type: 'mixpanel',
          sink: {
            mixpanelProjectId: 'project123',
            mixpanelServiceAccountPassword: 'secret_password',
            mixpanelServiceAccountUsername: 'service_account',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.mixpanelServiceAccountPassword).to.equal(
        '##LOGSTREAMS_MIXPANEL_SECRET##'
      );
      expect(result[0].sink.mixpanelProjectId).to.equal('project123');
      expect(result[0].sink.mixpanelServiceAccountUsername).to.equal('service_account');
    });

    it('should mask segmentWriteKey in log stream sink', () => {
      const logStreams = [
        {
          name: 'Segment Stream',
          type: 'segment',
          sink: {
            segmentRegion: 'us-west-2',
            segmentWriteKey: 'secret_write_key',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.segmentWriteKey).to.equal('##LOGSTREAMS_SEGMENT_SECRET##');
      expect(result[0].sink.segmentRegion).to.equal('us-west-2');
    });

    it('should mask multiple sensitive fields in a single log stream', () => {
      const logStreams = [
        {
          name: 'Multi-secret Stream',
          type: 'http',
          sink: {
            httpEndpoint: 'https://example.com/logs',
            httpAuthorization: 'Bearer secret_token',
            splunkToken: 'secret_splunk_token',
            datadogApiKey: 'secret_datadog_key',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.httpAuthorization).to.equal('##LOGSTREAMS_HTTP_SECRET##');
      expect(result[0].sink.splunkToken).to.equal('##LOGSTREAMS_HTTP_SECRET##');
      expect(result[0].sink.datadogApiKey).to.equal('##LOGSTREAMS_HTTP_SECRET##');
      expect(result[0].sink.httpEndpoint).to.equal('https://example.com/logs');
    });

    it('should handle multiple log streams with different types', () => {
      const logStreams = [
        {
          name: 'HTTP Stream',
          type: 'http',
          sink: {
            httpAuthorization: 'Bearer token1',
          },
        },
        {
          name: 'Splunk Stream',
          type: 'splunk',
          sink: {
            splunkToken: 'splunk_token',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.httpAuthorization).to.equal('##LOGSTREAMS_HTTP_SECRET##');
      expect(result[1].sink.splunkToken).to.equal('##LOGSTREAMS_SPLUNK_SECRET##');
    });

    it('should handle log streams without sink', () => {
      const logStreams = [
        {
          name: 'No Sink Stream',
          type: 'http',
          status: 'active',
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result).to.deep.equal(logStreams);
    });

    it('should handle log streams with sink but no sensitive fields', () => {
      const logStreams = [
        {
          name: 'Safe Stream',
          type: 'http',
          sink: {
            httpEndpoint: 'https://example.com/logs',
            httpContentType: 'application/json',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result).to.deep.equal(logStreams);
    });

    it('should handle empty log streams array', () => {
      const logStreams = [];

      const result = logStreamDefaults(logStreams);

      expect(result).to.deep.equal([]);
    });

    it('should handle log stream type with special characters', () => {
      const logStreams = [
        {
          name: 'Custom Stream',
          type: 'custom-http-2.0',
          sink: {
            httpAuthorization: 'Bearer token',
          },
        },
      ];

      const result = logStreamDefaults(logStreams);

      expect(result[0].sink.httpAuthorization).to.equal('##LOGSTREAMS_CUSTOM_HTTP_2_0_SECRET##');
    });
  });
});
