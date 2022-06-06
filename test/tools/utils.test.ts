import { expect } from 'chai';
import { getEnabledClients } from '../../src/tools/utils';

describe('#getEnabledClients', () => {
  const mockExclusions = {};
  const mockExistingConnections = [
    { name: 'Existing connection', enabled_clients: ['Client 1', 'Client 2'] },
  ];
  const mockClients = [
    { name: 'Client 1', id: 'client-1-id' },
    { name: 'Client 2', id: 'client-2-id' },
    { name: 'Client 3', id: 'client-3-id' },
  ];

  it('should return no enabled clients if connection does not have any', () => {
    const mockConnection = {
      enabled_clients: [], // No enabled clients!
      name: 'Target connection',
    };

    const enabledClients = getEnabledClients(
      mockExclusions,
      mockConnection,
      mockExistingConnections,
      mockClients
    );

    expect(enabledClients).to.deep.equal([]);
  });

  it('should return enabled clients when connection defines them', () => {
    const expectedEnabledClients = ['client-id-1', 'client-id-2']; // Two enabled clients!

    const mockConnection = {
      enabled_clients: expectedEnabledClients,
      name: 'Target connection',
    };

    const enabledClients = getEnabledClients(
      mockExclusions,
      mockConnection,
      mockExistingConnections,
      mockClients
    );

    expect(enabledClients).to.deep.equal(expectedEnabledClients);
  });

  it('should return undefined when enable clients is not defined', () => {
    const mockConnection = {
      enabled_clients: undefined, // This connection has no defined clients enabled. See: GH issue #523
      name: 'Target connection',
    };

    const enabledClients = getEnabledClients(
      mockExclusions,
      mockConnection,
      mockExistingConnections,
      mockClients
    );

    expect(enabledClients).to.equal(undefined);
  });
});
