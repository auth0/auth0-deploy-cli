import { expect } from 'chai';
import client from '../../../src/tools/auth0/client';

describe('#schema validation tests', async () => {
  it('should paginate a getAll query', async () => {
    const clients = [];
    const expectedNbClients = 1029;

    for (let i = 0; i < expectedNbClients; i++) {
      clients.push({
        name: 'test-' + i + '-' + Math.round(Math.random() * 10000000000),
      });
    }

    const mock = {
      clients: {
        getAll: async (args) =>
          new Promise((resolve) => {
            const localArgs = { ...args };
            setTimeout(() => {
              resolve({
                data: {
                  start: localArgs.page * localArgs.per_page,
                  total: expectedNbClients,
                  clients: clients.slice(
                    localArgs.page * localArgs.per_page,
                    (localArgs.page + 1) * localArgs.per_page
                  ),
                },
              });
            }, 10);
          }),
      },
    };

    const pagedManager = client(mock);

    const allClients = await pagedManager.clients.getAll({ paginate: true });

    expect(allClients.length).to.eq(expectedNbClients);
  });

  it('should paginate a nested object with getAll', async () => {
    const permissions = [];
    const expectedNbItems = 150;

    for (let i = 0; i < expectedNbItems; i++) {
      permissions.push({
        name: 'test-' + i + '-' + Math.round(Math.random() * 10000000000),
      });
    }

    const mock = {
      roles: {
        permissions: {
          getAll: async (localArgs) =>
            Promise.resolve({
              data: {
                start: localArgs.page * localArgs.per_page,
                total: expectedNbItems,
                permissions: permissions.slice(
                  localArgs.page * localArgs.per_page,
                  (localArgs.page + 1) * localArgs.per_page
                ),
              },
            }),
        },
      },
    };

    const pagedManager = client(mock);

    const rolesPermissions = await pagedManager.roles.permissions.getAll({ paginate: true });
    expect(rolesPermissions.length).to.eq(expectedNbItems);
  });
});
