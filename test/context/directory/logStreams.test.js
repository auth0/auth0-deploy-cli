import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/logStreams';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#directory context log streams', () => {
  it('should dump log streams with secrets masked by default', async () => {
    const dir = path.join(testDataDir, 'directory', 'logStreamsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.logStreams = [
      {
        name: 'test-stream',
        type: 'http',
        status: 'active',
        sink: {
          httpEndpoint: 'https://example.com/logs',
          httpAuthorization: 'real-secret-token',
          httpContentFormat: 'JSONLINES',
          httpContentType: 'application/json',
        },
      },
    ];

    await handler.dump(context);
    const logStreamsDir = path.join(dir, constants.LOG_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(logStreamsDir, 'test-stream.json'));

    expect(dumped.sink.httpAuthorization).to.equal('##LOGSTREAMS_HTTP_SECRET##');
    expect(dumped.sink.httpEndpoint).to.equal('https://example.com/logs');
  });

  it('should dump log streams with real secrets when AUTH0_EXPORT_SECRETS is true', async () => {
    const dir = path.join(testDataDir, 'directory', 'logStreamsDumpSecrets');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir, AUTH0_EXPORT_SECRETS: true },
      mockMgmtClient()
    );

    context.assets.logStreams = [
      {
        name: 'test-stream',
        type: 'http',
        status: 'active',
        sink: {
          httpEndpoint: 'https://example.com/logs',
          httpAuthorization: 'real-secret-token',
          httpContentFormat: 'JSONLINES',
          httpContentType: 'application/json',
        },
      },
    ];

    await handler.dump(context);
    const logStreamsDir = path.join(dir, constants.LOG_STREAMS_DIRECTORY);
    const dumped = loadJSON(path.join(logStreamsDir, 'test-stream.json'));

    expect(dumped.sink.httpAuthorization).to.equal('real-secret-token');
    expect(dumped.sink.httpEndpoint).to.equal('https://example.com/logs');
  });
});
