import { expect } from 'chai';
import { PromisePoolExecutor } from 'promise-pool-executor';
import logStreamsHandler from '../../../../src/tools/auth0/handlers/logStreams';

const mockLogStreams = [
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
  {
    id: 'log-stream-3',
    name: 'Datadog Log Stream',
    type: 'datadog',
    status: 'active',
    sink: {
      datadogApiKey: 'SOME_SENSITIVE_TOKEN',
      datadogRegion: 'us',
    },
  },
  {
    id: 'log-stream-4',
    name: 'Suspended HTTP Log Stream',
    type: 'http',
    status: 'suspended',
    sink: {
      httpAuthorization: 'SOME_SENSITIVE_TOKEN',
      httpContentFormat: 'JSONLINES',
      httpContentType: 'application/json',
      httpEndpoint: 'https://suspended.com/logs',
    },
  },
];

const auth0ApiClientMock = {
  logStreams: {
    getAll: async () => mockLogStreams,
    create: async () => mockLogStreams,
    update: async () => mockLogStreams,
    delete: async () => mockLogStreams,
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

      expect(data).to.deep.equal({
        logStreams: [
          {
            id: 'log-stream-1',
            name: 'Splunky',
            type: 'splunk',
            status: 'paused',
            sink: {
              splunkDomain: 'test-splunk.com',
              splunkPort: '8089',
              splunkToken: '_VALUE_NOT_SHOWN_', // secret obfuscated
              splunkSecure: false,
            },
          },
          {
            id: 'log-stream-2',
            name: 'HTTP Log Stream',
            type: 'http',
            status: 'active',
            sink: {
              httpAuthorization: '_VALUE_NOT_SHOWN_', // secret obfuscated
              httpContentFormat: 'JSONLINES',
              httpContentType: 'application/json',
              httpEndpoint: 'https://example.com/test',
            },
          },
          {
            id: 'log-stream-3',
            name: 'Datadog Log Stream',
            type: 'datadog',
            status: 'active',
            sink: {
              datadogApiKey: '_VALUE_NOT_SHOWN_', // secret obfuscated
              datadogRegion: 'us',
            },
          },
          {
            id: 'log-stream-4',
            name: 'Suspended HTTP Log Stream',
            type: 'http',
            // status property omitted if suspended
            sink: {
              httpAuthorization: '_VALUE_NOT_SHOWN_', // secret obfuscated
              httpContentFormat: 'JSONLINES',
              httpContentType: 'application/json',
              httpEndpoint: 'https://suspended.com/logs',
            },
          },
        ],
      });
    });

    it('should update log streams settings', async () => {
      let didUpdateFunctionGetCalled = false;

      const handler = new logStreamsHandler({
        config: () => {},
        client: auth0ApiClientMock,
        functions: {
          update: ({ id }, data) => {
            didUpdateFunctionGetCalled = true;
            const expectedValue = (() => {
              const value = mockLogStreams.find((logStream) => {
                return logStream.id === id;
              });
              delete value.id; // Not expecting ID in PATCH payload
              delete value.type; // Not expecting type in PATCH payload
              //@ts-ignore because it's actually ok for status property to be omitted in PATCH payload
              if (value?.status === 'suspended') delete value.status; // Not expecting status in PATCH payload if suspended
              return value;
            })();

            expect(data).to.deep.equal(expectedValue);
            return Promise.resolve(data);
          },
        },
      });

      await handler.processChanges({ logStreams: mockLogStreams });
      expect(didUpdateFunctionGetCalled).to.equal(true);
    });
  });
});
