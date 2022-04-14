const { expect } = require('chai');
const logStreamsHandler = require('../../../../src/tools/auth0/handlers/logStreams');

const logStreams = [
  {
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

const poolMock = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data);
    }
    return { promise: () => null };
  },
};

describe('#logStreams handler', () => {
  describe('#logStreams process', () => {
    it('should get log streams', async () => {
      const auth0 = {
        logStreams: {
          getAll: () => logStreams,
        },
        pool: poolMock,
      };

      const handler = new logStreamsHandler.default({ client: auth0 });
      const data = await handler.load();
      expect(data).to.deep.equal({ logStreams });
    });

    it('should update log streams settings', async () => {
      const updatedSettings = [
        {
          name: logStreams[0].name,
          status: 'paused',
        },
        {
          name: logStreams[1].name,
          status: 'paused',
        },
      ];

      const auth0 = {
        logStreams: {
          getAll: () => logStreams,
          update: (_params, data) => {
            expect(data).to.be.an('object');
            expect(Object.keys(data).length).to.equal(updatedSettings.length);
            Object.keys(data).forEach((logStream) => {
              expect(logStream.status).to.equal('paused');
            });
            return Promise.resolve(data);
          },
        },
        pool: poolMock,
      };

      const handler = new logStreamsHandler.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ logStreams: updatedSettings }]);
    });
  });
});
