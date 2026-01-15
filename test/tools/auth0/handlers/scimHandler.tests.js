/* eslint-disable no-unused-expressions, no-underscore-dangle */
const { PromisePoolExecutor } = require('promise-pool-executor');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const chai = require('chai');
const log = require('../../../../src/logger').default;
const ScimHandler = require('../../../../src/tools/auth0/handlers/scimHandler').default;

const { expect } = chai.use(chaiAsPromised);

// Mock data and functions
let mockConfig;
let mockConnectionsManager;

const mockPoolClient = new PromisePoolExecutor();

describe('ScimHandler', () => {
  let handler;

  beforeEach(() => {
    mockConfig = sinon.stub();
    mockConnectionsManager = {
      get: sinon.stub(),
      patch: sinon.stub(),
      delete: sinon.stub(),
      getAll: sinon.stub(),
      update: sinon.stub(),
      create: sinon.stub(),
      scimConfiguration: {
        get: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
      },
    };
    handler = new ScimHandler(mockConfig, mockConnectionsManager, mockPoolClient);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('isScimStrategy', () => {
    it('should return true for supported SCIM strategies', () => {
      expect(handler.isScimStrategy('samlp')).to.be.true;
      expect(handler.isScimStrategy('oidc')).to.be.true;
      expect(handler.isScimStrategy('okta')).to.be.true;
      expect(handler.isScimStrategy('waad')).to.be.true;
    });

    it('should return false for unsupported strategies', () => {
      expect(handler.isScimStrategy('google-auth')).to.be.false;
      expect(handler.isScimStrategy('auth0')).to.be.false;
      expect(handler.isScimStrategy('unsupported-any')).to.be.false;
    });
  });

  describe('createIdMap', () => {
    it('should create an id map for SCIM connections', async () => {
      const connections = [
        { id: 'con_kzpLY0Afi4I8lvwM', strategy: 'samlp' },
        { id: 'con_ilYXDjpVjU6GMnmk', strategy: 'auth0' }, // Un-supported strategy
      ];

      const response = {
        mapping: [{ scim: 'userName', auth0: 'preferred_username' }],
        user_id_attribute: 'externalId',
        connection_id: 'con_kzpLY0Afi4I8lvwM',
      };
      const expectedScimConfiguration = {
        mapping: response.mapping,
        user_id_attribute: response.user_id_attribute,
      };

      handler.getScimConfiguration = sinon.stub().resolves(response);
      await handler.createIdMap(connections);
      expect(handler.idMap.size).to.equal(1);
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.have.property('strategy', 'samlp');
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM'))
        .to.have.property('scimConfiguration')
        .that.deep.equals(expectedScimConfiguration);
      expect(handler.idMap.get('con_ilYXDjpVjU6GMnmk')).to.be.undefined;
    });

    it('should not create an id map when getScimConfiguration returns null', async () => {
      const connections = [{ id: 'con_kzpLY0Afi4I8lvwM', strategy: 'samlp' }];

      handler.getScimConfiguration = sinon.stub().resolves(null);
      await expect(handler.createIdMap(connections));
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.have.property('strategy', 'samlp');
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.not.have.property('scimConfiguration');
    });

    it('should handle errors from getScimConfiguration gracefully', async () => {
      const connections = [{ id: 'con_kzpLY0Afi4I8lvwM', strategy: 'samlp' }];

      handler.getScimConfiguration = sinon.stub().rejects({ statusCode: 404 });
      await expect(handler.createIdMap(connections));
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.have.property('strategy', 'samlp');
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.not.have.property('scimConfiguration');

      handler.getScimConfiguration = sinon.stub().rejects({ statusCode: 403 });
      await expect(handler.createIdMap(connections));
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.have.property('strategy', 'samlp');
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.not.have.property('scimConfiguration');

      handler.getScimConfiguration = sinon.stub().rejects({ statusCode: 429 });
      await expect(handler.createIdMap(connections));
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.have.property('strategy', 'samlp');
      expect(handler.idMap.get('con_kzpLY0Afi4I8lvwM')).to.not.have.property('scimConfiguration');

      handler.getScimConfiguration = sinon.stub().rejects(new Error('Unexpected error'));
      await expect(handler.createIdMap(connections)).to.be.rejectedWith('Unexpected error');
    });
  });

  describe('applyScimConfiguration', () => {
    it('should apply SCIM configuration to SCIM connections', async () => {
      const connections = [{ id: 'con_kzpLY0Afi4I8lvwM', strategy: 'samlp' }];
      const expectedScimConfiguration = {
        mapping: [{ scim: 'userName', auth0: 'preferred_username' }],
        user_id_attribute: 'externalId',
      };

      handler.idMap.set('con_kzpLY0Afi4I8lvwM', {
        strategy: 'samlp',
        scimConfiguration: expectedScimConfiguration,
      });
      await handler.applyScimConfiguration(connections);
      expect(connections[0])
        .to.have.property('scim_configuration')
        .that.deep.equals(expectedScimConfiguration);
    });

    it('should not modify connections if idMap is empty', async () => {
      const connections = [{ id: 'con_kzpLY0Afi4I8lvwM', strategy: 'samlp' }];

      mockConnectionsManager.scimConfiguration.get.resolves(null);
      await handler.applyScimConfiguration(connections);
      expect(connections[0]).to.not.have.property('scim_configuration');
    });
  });

  describe('createScimConfiguration', () => {
    it('should create SCIM configuration', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };
      const body = { user_id_attribute: 'id', mapping: [] };

      handler.createScimConfiguration = sinon.stub().resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      mockConnectionsManager.create.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      const result = await handler.createScimConfiguration(params, body);
      expect(result).to.deep.equal({ id: 'con_kzpLY0Afi4I8lvwM' });
    });

    it('should handle errors during creation', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };
      const body = { user_id_attribute: 'id', mapping: [] };

      handler.createScimConfiguration = sinon.stub().rejects(new Error('Unexpected error'));
      mockConnectionsManager.create.rejects(new Error('Unexpected error'));
      await expect(handler.createScimConfiguration(params, body)).to.be.rejectedWith(
        'Unexpected error'
      );
    });
  });

  describe('getScimConfiguration', () => {
    it('should retrieve SCIM configuration', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };

      handler.getScimConfiguration = sinon
        .stub()
        .resolves({ mapping: [], user_id_attribute: 'id' });
      mockConnectionsManager.get.resolves({ mapping: [], user_id_attribute: 'id' });

      const result = await handler.getScimConfiguration(params);
      expect(result).to.deep.equal({ mapping: [], user_id_attribute: 'id' });
    });

    it('should handle errors during retrieval', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };

      handler.getScimConfiguration = sinon.stub().rejects(new Error('Unexpected error'));
      mockConnectionsManager.get.rejects(new Error('Unexpected error'));
      await expect(handler.getScimConfiguration(params)).to.be.rejectedWith('Unexpected error');
    });
  });

  describe('updateScimConfiguration', () => {
    it('should update SCIM configuration', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };
      const body = { user_id_attribute: 'id', mapping: [] };

      handler.updateScimConfiguration = sinon.stub().resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      mockConnectionsManager.patch.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });

      const result = await handler.updateScimConfiguration(params, body);
      expect(result).to.deep.equal({ id: 'con_kzpLY0Afi4I8lvwM' });
    });

    it('should handle errors during update', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };
      const body = { user_id_attribute: 'id', mapping: [] };

      handler.updateScimConfiguration = sinon.stub().rejects(new Error('Unexpected error'));
      mockConnectionsManager.patch.rejects(new Error('Unexpected error'));
      await expect(handler.updateScimConfiguration(params, body)).to.be.rejectedWith(
        'Unexpected error'
      );
    });
  });

  describe('deleteScimConfiguration', () => {
    it('should delete SCIM configuration', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };

      handler.deleteScimConfiguration = sinon.stub().resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      mockConnectionsManager.delete.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });

      const result = await handler.deleteScimConfiguration(params);
      expect(result).to.deep.equal({ id: 'con_kzpLY0Afi4I8lvwM' });
    });

    it('should handle errors during deletion', async () => {
      const params = { id: 'con_kzpLY0Afi4I8lvwM' };

      handler.deleteScimConfiguration = sinon.stub().rejects(new Error('Unexpected error'));

      mockConnectionsManager.delete.rejects(new Error('Unexpected error'));
      await expect(handler.deleteScimConfiguration(params)).to.be.rejectedWith('Unexpected error');
    });
  });

  describe('updateOverride', () => {
    it('should update SCIM configuration when updating connection during updateOverride', async () => {
      const connectionId = 'con_kzpLY0Afi4I8lvwM';
      const bodyParams = { scim_configuration: { mapping: [], user_id_attribute: 'id' } };

      mockConnectionsManager.update.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      handler.updateScimConfiguration = sinon
        .stub()
        .resolves({ connection_id: 'con_kzpLY0Afi4I8lvwM' });
      handler.idMap.set('con_kzpLY0Afi4I8lvwM', {
        strategy: 'samlp',
        scimConfiguration: bodyParams.scim_configuration,
      });

      await handler.updateOverride(connectionId, bodyParams);
      expect(mockConnectionsManager.update.calledOnce).to.be.true;
      expect(handler.updateScimConfiguration.calledOnce).to.be.true;
    });

    it('should remove directory provisioning configuration before updating connection', async () => {
      const connectionId = 'con_dirprov';
      const bodyParams = {
        name: 'google-apps-connection',
        scim_configuration: { mapping: [], user_id_attribute: 'id' },
        directory_provisioning_configuration: { mapping: [{ auth0: 'email', idp: 'mail' }] },
      };

      handler.idMap.set('con_dirprov', {
        strategy: 'samlp',
        scimConfiguration: bodyParams.scim_configuration,
      });

      mockConnectionsManager.update.resolves({ id: 'con_dirprov' });
      handler.updateScimConfiguration = sinon.stub().resolves({ connection_id: 'con_dirprov' });

      await handler.updateOverride(connectionId, { ...bodyParams });

      const [, updateBody] = mockConnectionsManager.update.firstCall.args;
      expect(updateBody).to.not.have.property('directory_provisioning_configuration');
      expect(updateBody).to.not.have.property('scim_configuration');
      expect(updateBody).to.have.property('name', 'google-apps-connection');
      expect(handler.updateScimConfiguration.calledOnce).to.be.true;
    });

    it('should create SCIM configuration when updating connection during updateOverride', async () => {
      const connectionId = 'con_kzpLY0Afi4I8lvwM';
      const bodyParams = { scim_configuration: { mapping: [], user_id_attribute: 'id' } };

      mockConnectionsManager.update.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      handler.createScimConfiguration = sinon
        .stub()
        .resolves({ connection_id: 'con_kzpLY0Afi4I8lvwM' });

      await handler.updateOverride(connectionId, bodyParams);
      expect(mockConnectionsManager.update.calledOnce).to.be.true;
      expect(handler.createScimConfiguration.calledOnce).to.be.true;
    });

    it('should delete SCIM configuration when updating connection during updateOverride', async () => {
      const connectionId = 'con_kzpLY0Afi4I8lvwM';
      const bodyParams = {};

      mockConnectionsManager.update.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      handler.idMap.set('con_kzpLY0Afi4I8lvwM', {
        strategy: 'samlp',
        scimConfiguration: { mapping: [], user_id_attribute: 'id' },
      });
      handler.deleteScimConfiguration = sinon
        .stub()
        .resolves({ connection_id: 'con_kzpLY0Afi4I8lvwM' });
      handler.config.returns(true); // Setting `AUTH0_ALLOW_DELETE` to true.

      await handler.updateOverride(connectionId, bodyParams);
      expect(mockConnectionsManager.update.calledOnce).to.be.true;
      expect(handler.deleteScimConfiguration.calledOnce).to.be.true;
    });

    it('should not delete SCIM configuration when updating connection during updateOverride when AUTH0_ALLOW_DELETE is false', async () => {
      const connectionId = 'con_kzpLY0Afi4I8lvwM';
      const bodyParams = {};

      mockConnectionsManager.update.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      handler.idMap.set('con_kzpLY0Afi4I8lvwM', {
        strategy: 'samlp',
        scimConfiguration: { mapping: [], user_id_attribute: 'id' },
      });
      handler.deleteScimConfiguration = sinon
        .stub()
        .resolves({ connection_id: 'con_kzpLY0Afi4I8lvwM' });
      handler.config.returns(false); // Setting `AUTH0_ALLOW_DELETE` to false.

      await handler.updateOverride(connectionId, bodyParams);
      expect(mockConnectionsManager.update.calledOnce).to.be.true;
      expect(handler.deleteScimConfiguration.called).to.be.false;
    });

    it('should handle errors gracefully during updateOverride', async () => {
      const connectionId = 'con_kzpLY0Afi4I8lvwM';
      const bodyParams = { scim_configuration: { mapping: [], user_id_attribute: 'id' } };

      mockConnectionsManager.update.rejects(new Error('Unexpected error'));
      handler.updateScimConfiguration = sinon
        .stub()
        .resolves({ connection_id: 'con_kzpLY0Afi4I8lvwM' });

      await expect(handler.updateOverride(connectionId, bodyParams)).to.be.rejectedWith(
        'Unexpected error'
      );
      expect(handler.updateScimConfiguration.called).to.be.false;
    });
  });

  describe('createOverride', () => {
    it('should create SCIM configuration when creating connection', async () => {
      const bodyParams = { scim_configuration: { mapping: [], user_id_attribute: 'id' } };

      mockConnectionsManager.create.resolves({ id: 'con_kzpLY0Afi4I8lvwM' });
      handler.createScimConfiguration = sinon.stub().resolves({ id: 'con_kzpLY0Afi4I8lvwM' });

      await handler.createOverride(bodyParams);
      expect(mockConnectionsManager.create.calledOnce).to.be.true;
      expect(handler.createScimConfiguration.calledOnce).to.be.true;
    });

    it('should handle errors gracefully during createOverride', async () => {
      const bodyParams = { scim_configuration: { mapping: [], user_id_attribute: 'id' } };

      mockConnectionsManager.create.rejects(new Error('Unexpected error'));
      await expect(handler.createOverride(bodyParams)).to.be.rejectedWith('Unexpected error');
    });
  });

  describe('handleExpectedErrors', () => {
    it('should handle 404 errors and return null', async () => {
      const mockCallback = sinon.stub().rejects({ statusCode: 404 });
      const result = await handler.withErrorHandling(mockCallback, 'get', 'con_kzpLY0Afi4I8lvwM');
      expect(result).to.be.null;
      expect(mockCallback.calledOnce).to.be.true;
    });

    it('should handle 403 errors, log a warning, and return null', async () => {
      const mockCallback = sinon.stub().rejects({ statusCode: 403 });
      const logWarnSpy = sinon.spy(log, 'warn');
      const result = await handler.withErrorHandling(mockCallback, 'get', 'con_kzpLY0Afi4I8lvwM');
      expect(result).to.be.null;
      expect(mockCallback.calledOnce).to.be.true;
      expect(logWarnSpy.calledOnce).to.be.true;
      expect(logWarnSpy.firstCall.args[0]).to.include('Insufficient scope');
      logWarnSpy.restore();
    });

    it('should handle 400 errors with "already exists" message and return null', async () => {
      const mockCallback = sinon
        .stub()
        .rejects({ statusCode: 400, message: 'SCIM configuration already exists' });
      const result = await handler.withErrorHandling(
        mockCallback,
        'create',
        'con_kzpLY0Afi4I8lvwM'
      );
      expect(result).to.be.null;
      expect(mockCallback.calledOnce).to.be.true;
    });

    it('should handle 429 errors and return null', async () => {
      const mockCallback = sinon
        .stub()
        .rejects({ statusCode: 429, message: 'Rate limit exceeded' });
      const result = await handler.withErrorHandling(
        mockCallback,
        'create',
        'con_kzpLY0Afi4I8lvwM'
      );
      expect(result).to.be.null;
      expect(mockCallback.calledOnce).to.be.true;
    });

    it('should rethrow unexpected errors', async () => {
      const mockCallback = sinon.stub().rejects(new Error('Unexpected error'));
      await expect(
        handler.withErrorHandling(mockCallback, 'create', 'con_kzpLY0Afi4I8lvwM')
      ).to.be.rejectedWith('Unexpected error');
      expect(mockCallback.calledOnce).to.be.true;
    });
  });
});
