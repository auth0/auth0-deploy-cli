import { expect } from 'chai';
import { getEnabledClients, isDryRun, sortGuardianFactors } from '../../src/tools/utils';
import { hasKeywordMarkers, mapClientID2NameSorted } from '../../src/utils';

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

describe('#hasKeywordMarkers', () => {
  it('should detect array keyword markers', () => {
    const testString = '@@SOME_KEYWORD@@';
    const result = hasKeywordMarkers(testString);
    expect(result).to.be.true;
  });

  it('should detect string keyword markers', () => {
    const testString = '##SOME_KEYWORD##';
    const result = hasKeywordMarkers(testString);
    expect(result).to.be.true;
  });

  it('should return false for non-string values', () => {
    const testArray = ['client1', 'client2'];
    const result = hasKeywordMarkers(testArray);
    expect(result).to.be.false;
  });

  it('should return false for strings without markers', () => {
    const testString = 'regular string';
    const result = hasKeywordMarkers(testString);
    expect(result).to.be.false;
  });

  it('should return false for empty strings', () => {
    const testString = '';
    const result = hasKeywordMarkers(testString);
    expect(result).to.be.false;
  });
});

describe('#mapClientID2NameSorted', () => {
  const mockClients = [
    { name: 'Client B', client_id: 'client-b-id' },
    { name: 'Client A', client_id: 'client-a-id' },
    { name: 'Client C', client_id: 'client-c-id' },
  ];

  it('should handle array input normally', () => {
    const enabledClients = ['client-a-id', 'client-b-id'];
    const result = mapClientID2NameSorted(enabledClients, mockClients);
    expect(result).to.deep.equal(['Client A', 'Client B']);
  });

  it('should return string unchanged when input is a string', () => {
    const enabledClients = '@@DATABASE_ENABLED_CLIENTS@@';
    const result = mapClientID2NameSorted(enabledClients, mockClients);
    expect(result).to.equal('@@DATABASE_ENABLED_CLIENTS@@');
  });

  it('should handle empty array', () => {
    const enabledClients = [];
    const result = mapClientID2NameSorted(enabledClients, mockClients);
    expect(result).to.deep.equal([]);
  });

  it('should handle empty string enabled clients', () => {
    const result = mapClientID2NameSorted('', mockClients);
    expect(result).to.deep.equal('');
  });

  it('should preserve keyword markers in arrays', () => {
    const enabledClientsWithKeywords = ['##CLIENT_KEYWORD##', 'client-a-id'];
    const result = mapClientID2NameSorted(enabledClientsWithKeywords, mockClients);

    const expectedClientsWithKeywords = ['##CLIENT_KEYWORD##', 'Client A'];
    expect(result).to.deep.equal(expectedClientsWithKeywords);
  });
});

describe('#isDryRun', () => {
  it('should return true when config returns boolean true', () => {
    const config = (key: string) => (key === 'AUTH0_DRY_RUN' ? true : undefined);
    expect(isDryRun(config)).to.be.true;
  });

  it('should return true when config returns string "true"', () => {
    const config = (key: string) => (key === 'AUTH0_DRY_RUN' ? 'true' : undefined);
    expect(isDryRun(config)).to.be.true;
  });

  it('should return false when config returns "preview"', () => {
    const config = (key: string) => (key === 'AUTH0_DRY_RUN' ? 'preview' : undefined);
    expect(isDryRun(config)).to.be.false;
  });

  it('should return false when config returns undefined', () => {
    const config = (_key: string) => undefined;
    expect(isDryRun(config)).to.be.false;
  });

  it('should return false when config is not a function', () => {
    expect(isDryRun('not-a-function' as any)).to.be.false;
    expect(isDryRun(null as any)).to.be.false;
  });
});

describe('#sortGuardianFactors', () => {
  it('should sort factors alphabetically by name', () => {
    const factors = [
      { name: 'sms', enabled: true },
      { name: 'email', enabled: false },
      { name: 'duo', enabled: false },
    ];
    const sorted = sortGuardianFactors(factors);
    expect(sorted.map((f) => f.name)).to.deep.equal(['duo', 'email', 'sms']);
  });

  it('should return empty array for null input', () => {
    expect(sortGuardianFactors(null as any)).to.deep.equal([]);
  });

  it('should return empty array for empty array input', () => {
    expect(sortGuardianFactors([])).to.deep.equal([]);
  });

  it('should handle factors without name property', () => {
    const factors = [{ enabled: true }, { name: 'abc', enabled: false }];
    const sorted = sortGuardianFactors(factors);
    expect(sorted[0].name).to.equal(undefined);
    expect(sorted[1].name).to.equal('abc');
  });
});
