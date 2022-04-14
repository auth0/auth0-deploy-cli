import { expect } from 'chai';
import { PromisePoolExecutor } from 'promise-pool-executor';
import logStreamsHandler from '../../../../src/tools/auth0/handlers/logStreams';

const logStreams = [
  {
    id: 'log-stream-1',
    name: 'Splunky',
    type: 'splunk',
    status: 'paused',
    sink: {
      splunkDomain: 'test-splunk.com',
      splunkPort: '8089',
      splunkToken: '7b838bd0-028e-4d78-a82c-3564a2007770',
      splunkSecure: false,
    },
  },
  {
    id: 'log-stream-2',
    name: 'HTTP Log Stream',
    type: 'http',
    status: 'active',
    sink: {
      httpAuthorization: 'SOME_SENSITIVE_TOKEN',
      httpContentFormat: 'JSONLINES',
      httpContentType: 'application/json',
      httpEndpoint: 'https://example.com/test',
    },
  },
];

const auth0ApiClientMock = {
  logStreams: {
    getAll: async () => logStreams,
    update: async () => logStreams,
    delete: async () => logStreams,
  },
  pool: new PromisePoolExecutor({
    concurrencyLimit: 3,
    frequencyLimit: 8,
    frequencyWindow: 1000, // 1 sec
  }),
};

describe('#logStreams handler', () => {
  describe('#logStreams process', () => {
    it('should get log streams', async () => {
      const handler = new logStreamsHandler({ client: auth0ApiClientMock });
      const data = await handler.load();
      expect(data).to.deep.equal({ logStreams });
    });

    it('should update log streams settings', async () => {
      let didUpdateFunctionGetCalled = false;

      const handler = new logStreamsHandler({
        client: auth0ApiClientMock,
        functions: {
          update: ({ id }, data) => {
            didUpdateFunctionGetCalled = true;
            const expectedValue = (() => {
              const value = logStreams.find((logStream) => {
                return logStream.id === id;
              });
              delete value.id;
              delete value.type;
              return value;
            })();

            expect(data).to.deep.equal(expectedValue);
            return Promise.resolve(data);
          },
        },
      });

      await handler.processChanges({ logStreams });
      expect(didUpdateFunctionGetCalled).to.equal(true);
    });
  });
});
