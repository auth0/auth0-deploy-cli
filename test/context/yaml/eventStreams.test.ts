import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/eventStreams';
import { mockMgmtClient } from '../../utils';

describe('#YAML context event streams', () => {
  it('should parse event streams from YAML', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'My Webhook Stream',
        status: 'enabled',
        subscriptions: [{ event_type: 'user.created' }],
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: { method: 'bearer' },
          },
        },
      },
    ] as any;

    const parsed = await handler.parse(context);
    expect(parsed.eventStreams).to.deep.equal(context.assets.eventStreams);
  });

  it('should dump event streams with webhook bearer token masked', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-webhook-stream',
        status: 'enabled',
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: {
              method: 'bearer',
              token: 'real-secret-token',
            },
          },
        },
      },
    ];

    const dumped = await handler.dump(context);
    const stream = (dumped.eventStreams as any[])[0];
    expect(stream.destination.configuration.webhook_authorization.token).to.equal(
      '##EVENT_STREAM_WEBHOOK_BEARER_TOKEN##'
    );
  });

  it('should dump event streams with real secrets when AUTH0_EXPORT_SECRETS is true', async () => {
    const context = new Context(
      { AUTH0_INPUT_FILE: './test.yml', AUTH0_EXPORT_SECRETS: true },
      mockMgmtClient()
    );

    context.assets.eventStreams = [
      {
        name: 'my-webhook-stream',
        status: 'enabled',
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: {
              method: 'bearer',
              token: 'real-secret-token',
            },
          },
        },
      },
    ];

    const dumped = await handler.dump(context);
    const stream = (dumped.eventStreams as any[])[0];
    expect(stream.destination.configuration.webhook_authorization.token).to.equal(
      'real-secret-token'
    );
  });

  it('should dump event streams with custom_header masked', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-header-stream',
        status: 'enabled',
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: {
              method: 'custom_header',
              header_key: 'X-Api-Key',
              header_value: 'super-secret',
            },
          },
        },
      },
    ];

    const dumped = await handler.dump(context);
    const stream = (dumped.eventStreams as any[])[0];
    const auth = stream.destination.configuration.webhook_authorization;
    expect(auth.header_key).to.equal('X-Api-Key');
    expect(auth.header_value).to.equal('##EVENT_STREAM_WEBHOOK_HEADER_VALUE##');
  });

  it('should dump event streams with basic auth — preserves username, masks password', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-basic-auth-stream',
        status: 'enabled',
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: {
              method: 'basic',
              username: 'deploy-user',
              password: 'real-password',
            },
          },
        },
      },
    ];

    const dumped = await handler.dump(context);
    const stream = (dumped.eventStreams as any[])[0];
    const auth = stream.destination.configuration.webhook_authorization;
    expect(auth.method).to.equal('basic');
    expect(auth.username).to.equal('deploy-user');
    expect(auth.password).to.equal('##EVENT_STREAM_WEBHOOK_BASIC_AUTH_PASSWORD##');
  });

  it('should strip created_at and updated_at on dump', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-stream',
        status: 'enabled',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-01T00:00:00.000Z',
        destination: {
          type: 'action',
          configuration: { action_id: 'act_abc' },
        },
      },
    ];

    const dumped = await handler.dump(context);
    const stream = (dumped.eventStreams as any[])[0];
    expect(stream).to.not.have.property('created_at');
    expect(stream).to.not.have.property('updated_at');
    expect(stream.name).to.equal('my-stream');
  });

  it('should return null when eventStreams is not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const dumped = await handler.dump(context);
    expect(dumped.eventStreams).to.equal(null);
  });
});
