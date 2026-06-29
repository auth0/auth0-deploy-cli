import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/eventStreams';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#directory context event streams', () => {
  it('should dump event streams and mask webhook bearer token', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-webhook-stream',
        status: 'enabled',
        subscriptions: [{ event_type: 'user.created' }],
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

    await handler.dump(context);

    const eventStreamsDir = path.join(dir, constants.EVENT_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(eventStreamsDir, 'my-webhook-stream.json'));

    expect(dumped.destination.configuration.webhook_authorization.token).to.equal(
      '##EVENT_STREAM_WEBHOOK_BEARER_TOKEN##'
    );
    expect(dumped.destination.configuration.webhook_endpoint).to.equal(
      'https://example.com/events'
    );
  });

  it('should dump event streams with real secrets when AUTH0_EXPORT_SECRETS is true', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsDumpSecrets');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir, AUTH0_EXPORT_SECRETS: true },
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

    await handler.dump(context);

    const eventStreamsDir = path.join(dir, constants.EVENT_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(eventStreamsDir, 'my-webhook-stream.json'));

    expect(dumped.destination.configuration.webhook_authorization.token).to.equal(
      'real-secret-token'
    );
  });

  it('should dump event streams with basic auth — preserves username, masks password', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsDumpBasicAuth');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

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

    await handler.dump(context);

    const eventStreamsDir = path.join(dir, constants.EVENT_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(eventStreamsDir, 'my-basic-auth-stream.json'));
    const auth = dumped.destination.configuration.webhook_authorization;

    expect(auth.method).to.equal('basic');
    expect(auth.username).to.equal('deploy-user');
    expect(auth.password).to.equal('##EVENT_STREAM_WEBHOOK_BASIC_AUTH_PASSWORD##');
  });

  it('should dump eventbridge streams without masking', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsDumpEB');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-eventbridge-stream',
        status: 'enabled',
        destination: {
          type: 'eventbridge',
          configuration: {
            aws_account_id: '123456789012',
            aws_region: 'us-east-1',
          },
        },
      },
    ];

    await handler.dump(context);

    const eventStreamsDir = path.join(dir, constants.EVENT_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(eventStreamsDir, 'my-eventbridge-stream.json'));

    expect(dumped.destination.configuration.aws_account_id).to.equal('123456789012');
  });

  it('should parse event streams from directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsParse');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    // First dump so we have files to parse
    context.assets.eventStreams = [
      {
        name: 'my-webhook-stream',
        status: 'enabled',
        destination: {
          type: 'webhook',
          configuration: {
            webhook_endpoint: 'https://example.com/events',
            webhook_authorization: { method: 'bearer' },
          },
        },
      },
    ];

    await handler.dump(context);

    // Now parse
    const parsed = handler.parse(context);
    expect(parsed.eventStreams).to.be.an('array');
    expect(parsed.eventStreams!.length).to.equal(1);
    expect((parsed.eventStreams![0] as any).name).to.equal('my-webhook-stream');
  });

  it('should strip created_at and updated_at on dump', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsDumpTimestamps');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.eventStreams = [
      {
        name: 'my-action-stream',
        status: 'enabled',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-01T00:00:00.000Z',
        destination: {
          type: 'action',
          configuration: { action_id: 'act_abc' },
        },
      },
    ];

    await handler.dump(context);

    const eventStreamsDir = path.join(dir, constants.EVENT_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(eventStreamsDir, 'my-action-stream.json'));

    expect(dumped).to.not.have.property('created_at');
    expect(dumped).to.not.have.property('updated_at');
    expect(dumped.name).to.equal('my-action-stream');
  });

  it('should return null when event-streams directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'eventStreamsEmpty');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const parsed = handler.parse(context);
    expect(parsed.eventStreams).to.equal(null);
  });
});
