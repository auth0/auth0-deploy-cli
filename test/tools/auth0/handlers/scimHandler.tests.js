const { expect } = require('chai');
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');
const sinon = require('sinon');
const ScimHandler = require('../../../../src/tools/auth0/handlers/scimHandler').default;

let scimHandler;
beforeEach(() => {
  const connectionResponse = {
    id: 'con_PKp644cmKtnEB11J',
    name: 'test-connection'
  };
  const connectionsManagerMock = {
    update: sinon.stub().resolves(connectionResponse),
    create: sinon.stub().resolves(connectionResponse)
  };

  scimHandler = new ScimHandler(
    function() { return 'https://test-host.auth0.com'; }, 
    {
      getAccessToken: async function () {
        return 'mock_access_token';
      }
    },
    connectionsManagerMock
  );
});

describe('ScimHandler', () => {
  describe('#isScimStrategy', () => {
    it('should return true for SCIM strategy', () => {
      const response = scimHandler.isScimStrategy('samlp');
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.be.true;
    });

    it('should return false for non-SCIM strategy', () => {
      const response = scimHandler.isScimStrategy('oauth');
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.be.false;
    });
  });

  describe('#createIdMap', () => {
    it('should create id map with SCIM configuration', async () => {
      const connections = [
        { id: 'con_KYp633cmKtnEQ31C', strategy: 'samlp' }, // SCIM connection.
        { id: 'con_Njd1bxE3QTqTRwAk', strategy: 'auth0' }, // Non-SCIM connection.
        { id: 'con_d3tmuoAkaUQgxN1f', strategy: 'gmail' } // Connection which doesn't exist.
      ];
      const getScimConfigurationStub = sinon.stub(scimHandler, 'getScimConfiguration');
      getScimConfigurationStub.withArgs({ id: 'con_KYp633cmKtnEQ31C' }).resolves({ user_id_attribute: 'externalId-115', mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }] });
      getScimConfigurationStub.withArgs({ id: 'con_Njd1bxE3QTqTRwAk' }).rejects({ response: { data: { statusCode: 404 } } });
      getScimConfigurationStub.withArgs({ id: 'con_d3tmuoAkaUQgxN1f' }).rejects({ response: { data: { statusCode: 404 } } });

      await scimHandler.createIdMap(connections);
      // eslint-disable-next-line no-unused-expressions
      expect(scimHandler.idMap.get('con_KYp633cmKtnEQ31C')).to.deep.equal({ strategy: 'samlp', hasConfig: true });

      // eslint-disable-next-line no-unused-expressions
      expect(scimHandler.idMap.get('con_Njd1bxE3QTqTRwAk')).to.be.undefined; // Because, it's a Non-SCIM connection.

      // eslint-disable-next-line no-unused-expressions
      expect(scimHandler.idMap.get('con_d3tmuoAkaUQgxN1f')).to.be.undefined;

      getScimConfigurationStub.restore();
    });
  });

  describe('#applyScimConfiguration', () => {
    it('should apply SCIM configuration to connections', async () => {
      const connections = [
        { id: 'con_KYp633cmKtnEQ31C', strategy: 'samlp' },
        { id: 'con_Njd1bxE3QTqTRwAk', strategy: 'oidc' },
        { id: 'con_d3tmuoAkaUQgxN1f', strategy: 'gmail' }
      ];
      const getScimConfigurationStub = sinon.stub(scimHandler, 'getScimConfiguration');
      getScimConfigurationStub.withArgs({ id: 'con_KYp633cmKtnEQ31C' }).resolves({ user_id_attribute: 'externalId-1', mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }] });
      getScimConfigurationStub.withArgs({ id: 'con_Njd1bxE3QTqTRwAk' }).resolves({ user_id_attribute: 'externalId-2', mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }] });
      getScimConfigurationStub.withArgs({ id: 'con_d3tmuoAkaUQgxN1f' }).rejects({ response: { status: 404 } });

      await scimHandler.applyScimConfiguration(connections);

      // eslint-disable-next-line no-unused-expressions
      expect(connections[0].scim_configuration).to.deep.equal({ user_id_attribute: 'externalId-1', mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }] });

      // eslint-disable-next-line no-unused-expressions
      expect(connections[1].scim_configuration).to.deep.equal({ user_id_attribute: 'externalId-2', mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }] });
      
      // eslint-disable-next-line no-unused-expressions
      expect(connections[2].scim_configuration).to.be.undefined;

      getScimConfigurationStub.restore();
    });
  });

  describe('#scimHttpRequest', () => {
    it('should make HTTP request with correct authorization header', async () => {
      const accessToken = 'mock_access_token';
      const axiosStub = sinon.stub(axios, 'get').resolves({ data: {} });
      const response = await scimHandler.scimHttpRequest('get', ['https://mock-domain/api/v2/connections/1/scim-configuration']);
      
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.exist;

      // eslint-disable-next-line no-unused-expressions
      expect(axiosStub.calledOnce).to.be.true;

      // eslint-disable-next-line no-unused-expressions
      expect(axiosStub.firstCall.args[1].headers.Authorization).to.equal(`Bearer ${accessToken}`);

      axiosStub.restore();
    });
  });

  describe('#getScimConfiguration', () => {
    it('should return SCIM configuration for existing connection', async () => {
      const requestParams = { id: 'con_KYp633cmKtnEQ31C' };
      const scimConfiguration = {
        connection_id: 'con_KYp633cmKtnEQ31C',
        connection_name: 'okta',
        strategy: 'okta',
        tenant_name: 'test-tenant',
        user_id_attribute: 'externalId-1',
        mapping: [
          {
            scim: 'scim_id',
            auth0: 'auth0_id'
          }
        ]
      };

      const axiosStub = sinon.stub(axios, 'get').resolves({ data: scimConfiguration, status: 201 });
      const response = await scimHandler.getScimConfiguration(requestParams);
      expect(response).to.deep.equal(scimConfiguration);

      axiosStub.restore();
    });

    it('should throw error for non-existing SCIM configuration', async () => {
      const requestParams = { id: 'con_KYp633cmKtnEQ31C' };
      const axiosStub = sinon.stub(axios, 'get').rejects({ response: { status: 404, errorCode: 'not-found', statusText: 'The connection does not exist' } });

      try {
        await scimHandler.getScimConfiguration(requestParams);
        expect.fail('Expected getScimConfiguration to throw an error');
      } catch (error) {
        expect(error.response.status).to.equal(404);
      }

      axiosStub.restore();
    });
  });

  describe('#createScimConfiguration', () => {
    const requestParams = {
      id: 'con_PKp644cmKtnEB11J'
    };
    const payload = {
      user_id_attribute: 'externalId-5',
      mapping: [
        {
          scim: 'scim_key',
          auth0: 'auth0_key'
        }
      ]
    };
    const responseBody = {
      connection_id: 'con_PKp644cmKtnEB11J',
      connection_name: 'okta-new-connection',
      strategy: 'okta',
      tenant_name: 'test-tenant',
      ...requestParams,
      ...payload,
      created_at: new Date().getTime(),
      updated_on: new Date().getTime()
    };

    it('should create new SCIM configuration', async () => {
      const axiosStub = sinon.stub(axios, 'post').resolves({ data: responseBody, status: 201 });
      const response = await scimHandler.createScimConfiguration(requestParams, payload);

      expect(response.connection_id).to.equal(requestParams.id);
      expect(response.user_id_attribute).to.equal(responseBody.user_id_attribute);
      expect(response.mapping).to.deep.equal(responseBody.mapping);

      axiosStub.restore();
    });
  });

  describe('#updateScimConfiguration', () => {
    it('should update existing SCIM configuration', async () => {
      const requestParams = {
        id: 'con_PKp644cmKtnEB11J'
      };
      const payload = {
        user_id_attribute: 'externalId-5',
        mapping: [
          {
            scim: 'scim_key',
            auth0: 'auth0_key'
          }
        ]
      };
      const responseBody = {
        connection_id: 'con_PKp644cmKtnEB11J',
        connection_name: 'okta-new-connection',
        strategy: 'okta',
        tenant_name: 'test-tenant',
        ...requestParams,
        ...payload,
        created_at: new Date().getTime(),
        updated_on: new Date().getTime()
      };
      const axiosStub = sinon.stub(axios, 'patch').resolves({ data: responseBody, status: 200 });
      const response = await scimHandler.updateScimConfiguration(requestParams, payload);

      expect(response.connection_id).to.equal(requestParams.id);
      expect(response.user_id_attribute).to.equal(responseBody.user_id_attribute);
      expect(response.mapping).to.deep.equal(responseBody.mapping);

      axiosStub.restore();
    });
  });

  describe('#deleteScimConfiguration', () => {
    it('should delete existing SCIM configuration', async () => {
      const requestParams = {
        id: 'con_PKp644cmKtnEB11J'
      };
      const axiosStub = sinon.stub(axios, 'delete').resolves({ data: {}, status: 204 });
      const response = await scimHandler.deleteScimConfiguration(requestParams);
      expect(response).to.deep.equal({});

      axiosStub.restore();
    });
  });

  describe('#updateOverride', () => {
    it('should \'update\' connection and \'update\' SCIM configuration', async () => {
      const requestParams = { id: 'con_PKp644cmKtnEB11J' };
      const bodyParams = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection',
        scim_configuration: {
          user_id_attribute: 'externalId-115',
          mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }]
        }
      };
      const connectionUpdatePayload = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const { scim_configuration: scimConfiguration } = bodyParams;
      const idMapEntry = {
        strategy: 'samlp',
        hasConfig: true
      };
      const idMapMock = new Map();
      idMapMock.set(requestParams.id, idMapEntry);
      scimHandler.idMap = idMapMock;

      const updateScimStub = sinon.stub(scimHandler, 'updateScimConfiguration').resolves({ data: {} });
      const response = await scimHandler.updateOverride(requestParams, bodyParams);
  
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.deep.equal(connectionUpdatePayload);

      // eslint-disable-next-line no-unused-expressions
      expect(updateScimStub.calledOnceWith(requestParams, scimConfiguration)).to.be.true;
  
      updateScimStub.restore();
    });

    it('should \'update\' connection and \'create\' SCIM configuration', async () => {
      const requestParams = { id: 'con_PKp644cmKtnEB11J' };
      const bodyParams = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection',
        scim_configuration: {
          user_id_attribute: 'externalId-115',
          mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }]
        }
      };
      const connectionUpdatePayload = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const { scim_configuration: scimConfiguration } = bodyParams;
      const idMapEntry = {
        strategy: 'samlp',
        hasConfig: false
      };
      const idMapMock = new Map();
      idMapMock.set(requestParams.id, idMapEntry);
      scimHandler.idMap = idMapMock;

      const createScimStub = sinon.stub(scimHandler, 'createScimConfiguration').resolves({ data: {} });
      const response = await scimHandler.updateOverride(requestParams, bodyParams);
  
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.deep.equal(connectionUpdatePayload);

      // eslint-disable-next-line no-unused-expressions
      expect(createScimStub.calledOnceWith(requestParams, scimConfiguration)).to.be.true;
  
      createScimStub.restore();
    });

    it('should \'update\' connection and \'delete\' SCIM configuration', async () => {
      const requestParams = { id: 'con_PKp644cmKtnEB11J' };
      const bodyParams = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const connectionUpdatePayload = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const idMapEntry = {
        strategy: 'samlp',
        hasConfig: true
      };
      const idMapMock = new Map();
      idMapMock.set(requestParams.id, idMapEntry);

      scimHandler.idMap = idMapMock;

      const deleteScimStub = sinon.stub(scimHandler, 'deleteScimConfiguration').resolves({ data: {} });
      const response = await scimHandler.updateOverride(requestParams, bodyParams);
  
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.deep.equal(connectionUpdatePayload);

      // eslint-disable-next-line no-unused-expressions
      expect(deleteScimStub.calledOnceWith(requestParams)).to.be.true;
  
      deleteScimStub.restore();
    });
  });
  
  describe('#createOverride', () => {
    it('should \'create\' connection and \'create\' SCIM configuration', async () => {
      const requestParams = { id: 'con_PKp644cmKtnEB11J' };
      const bodyParams = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection',
        scim_configuration: {
          user_id_attribute: 'externalId-115',
          mapping: [{ auth0: 'auth0_key', scim: 'scim_key' }]
        }
      };
      const connectionCreatePayload = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const { scim_configuration: scimConfiguration } = bodyParams;
      const idMapEntry = {
        strategy: 'samlp',
        hasConfig: false
      };
      const idMapMock = new Map();
      idMapMock.set(requestParams.id, idMapEntry);
      scimHandler.idMap = idMapMock;

      const createScimStub = sinon.stub(scimHandler, 'createScimConfiguration').resolves({ data: {} });
      const response = await scimHandler.createOverride(bodyParams);
  
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.deep.equal(connectionCreatePayload);

      // eslint-disable-next-line no-unused-expressions
      expect(createScimStub.calledOnceWith(requestParams, scimConfiguration)).to.be.true;
  
      createScimStub.restore();
    });

    it('should \'create\' connection without SCIM configuration', async () => {
      const requestParams = { id: 'con_PKp644cmKtnEB11J' };
      const bodyParams = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const connectionUpdatePayload = {
        id: 'con_PKp644cmKtnEB11J',
        name: 'test-connection'
      };
      const idMapEntry = {
        strategy: 'samlp',
        hasConfig: false
      };
      const idMapMock = new Map();
      idMapMock.set(requestParams.id, idMapEntry);
      scimHandler.idMap = idMapMock;

      const createScimStub = sinon.stub(scimHandler, 'createScimConfiguration').resolves({ data: {} });
      const response = await scimHandler.createOverride(requestParams, bodyParams);
  
      // eslint-disable-next-line no-unused-expressions
      expect(response).to.deep.equal(connectionUpdatePayload);

      // eslint-disable-next-line no-unused-expressions
      expect(createScimStub.calledOnce).to.be.false;
  
      createScimStub.restore();
    });
  });
});
