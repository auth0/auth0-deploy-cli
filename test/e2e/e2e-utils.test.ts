import { expect } from 'chai';
import { sanitizeObject } from './e2e-utils';

describe('#sanitizeObject', function () {
  it('should sanitize an object input', async function () {
    const payload = {
      client_id: 'client-id-1',
      client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
      connection: {
        secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
        id: 'connection-1',
      },
      keys: {
        data: [{ client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!' }],
      },
      clients: [
        {
          client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
          client_id: 'client-1',
          meta: {
            secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
            api_key: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
            nonSecret: 'some non sensitive value',
          },
        },
        {
          client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
          client_id: 'client-2',
        },
      ],
    };

    const sanitized = sanitizeObject(payload, ['client_secret', 'secret', 'api_key']);

    expect(sanitized).to.deep.equal({
      client_id: 'client-id-1',
      client_secret: '[REDACTED]',
      connection: {
        secret: '[REDACTED]',
        id: 'connection-1',
      },
      keys: {
        data: [{ client_secret: '[REDACTED]' }],
      },
      clients: [
        {
          client_id: 'client-1',
          client_secret: '[REDACTED]',
          meta: {
            nonSecret: 'some non sensitive value',
            secret: '[REDACTED]',
            api_key: '[REDACTED]',
          },
        },
        {
          client_id: 'client-2',
          client_secret: '[REDACTED]',
        },
      ],
    });
  });

  it('should sanitize an array input', async function () {
    const payload = [
      {
        client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
        client_id: 'client-1',
        api_key: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
        meta: {
          secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
          api_key: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
        },
      },
      {
        client_id: 'client-2',
        client_secret: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!',
        secrets: [{ api_key: 'SENSITIVE VALUE THAT SHOULD BE REDACTED!', secret_id: 'foo' }],
      },
    ];

    const sanitized = sanitizeObject(payload, ['client_secret', 'secret', 'api_key']);

    expect(sanitized).to.deep.equal([
      {
        client_secret: '[REDACTED]',
        client_id: 'client-1',
        api_key: '[REDACTED]',
        meta: {
          secret: '[REDACTED]',
          api_key: '[REDACTED]',
        },
      },
      {
        client_id: 'client-2',
        client_secret: '[REDACTED]',
        secrets: [{ api_key: '[REDACTED]', secret_id: 'foo' }],
      },
    ]);
  });

  it('should not mutate a string input', async function () {
    expect(sanitizeObject('some-string', ['api_key', 'client_secret'])).to.equal('some-string');
  });
});
