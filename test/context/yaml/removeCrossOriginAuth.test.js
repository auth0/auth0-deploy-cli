import { expect } from 'chai';
import _ from 'lodash';

describe('remove cross_origin_auth from clients', () => {
  it('should remove cross_origin_auth from all clients', () => {
    const cleaned = {
      clients: [
        { name: 'ClientA', cross_origin_auth: true, other: 'foo' },
        { name: 'ClientB', cross_origin_auth: false, other: 'bar' },
        { name: 'ClientC', other: 'baz' }
      ]
    };
    cleaned.clients = cleaned.clients?.map(client => _.omit(client, ['cross_origin_auth']));
    cleaned.clients.forEach(client => {
      expect(client).to.not.have.property('cross_origin_auth');
    });
  });

  it('should not fail if cross_origin_auth is missing', () => {
    const cleaned = {
      clients: [
        { name: 'ClientA', other: 'foo' },
        { name: 'ClientB', other: 'bar' }
      ]
    };
    cleaned.clients = cleaned.clients?.map(client => _.omit(client, ['cross_origin_auth']));
    cleaned.clients.forEach(client => {
      expect(client).to.have.property('name');
      expect(client).to.not.have.property('cross_origin_auth');
    });
  });

  it('should preserve other client properties', () => {
    const cleaned = {
      clients: [
        { name: 'ClientA', cross_origin_auth: true, app_type: 'spa' },
        { name: 'ClientB', cross_origin_auth: false, app_type: 'native' }
      ]
    };
    cleaned.clients = cleaned.clients?.map(client => _.omit(client, ['cross_origin_auth']));
    expect(cleaned.clients[0]).to.have.property('app_type', 'spa');
    expect(cleaned.clients[1]).to.have.property('app_type', 'native');
  });

  it('should handle empty clients array', () => {
    const cleaned = { clients: [] };
    cleaned.clients = cleaned.clients?.map(client => _.omit(client, ['cross_origin_auth']));
    expect(cleaned.clients).to.be.an('array');
    expect(cleaned.clients).to.have.lengthOf(0);
  });

  it('should handle undefined clients', () => {
    const cleaned = {};
    cleaned.clients = cleaned.clients?.map(client => _.omit(client, ['cross_origin_auth']));
    expect(cleaned.clients).to.equal(undefined);
  });
});
