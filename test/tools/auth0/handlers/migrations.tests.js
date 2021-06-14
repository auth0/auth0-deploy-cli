import migrations from '../../../../src/tools/auth0/handlers/migrations';

const { expect } = require('chai');

describe('#migrations handler', () => {
  const mockClient = (flags) => ({
    migrations: {
      getMigrations: () => ({
        flags: {
          migration_flag: true
        }
      }),
      updateMigrations: (data) => {
        expect(data).to.be.an('object');
        expect(data).to.have.deep.property('flags', { migration_flag: false, ...flags });
        return Promise.resolve(data);
      }
    }
  });

  describe('#getType()', () => {
    it('should get migration flags', async () => {
      const client = mockClient();

      const handler = new migrations({ client });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        migration_flag: true
      });
    });

    it('should support when endpoint does not exist (older installations)', async () => {
      const client = {
        migrations: {
          getMigrations: () => {
            const err = new Error('Not Found');
            err.name = 'Not Found';
            err.statusCode = 404;
            err.requestInfo = {
              method: 'get',
              url: 'https://example.auth0.com/api/v2/migrations'
            };
            err.originalError = new Error('Not Found');
            err.originalError.status = 404;
            err.originalError.response = {
              body: {
                statusCode: 404,
                error: 'Not Found',
                message: 'Not Found'
              }
            };
            return Promise.reject(err);
          }
        }
      };

      const handler = new migrations({ client });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });
  });

  describe('#migrations process', () => {
    it('should update available migration flags', async () => {
      const client = mockClient();
      const config = () => false;

      const handler = new migrations({ client, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ {
        migrations: {
          migration_flag: false
        }
      } ]);
    });

    describe('when AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS=false (default)', () => {
      it('should ignore unavailable disabled migration flags', async () => {
        const client = mockClient();
        const config = () => false;

        const handler = new migrations({ client, config });
        const stageFn = Object.getPrototypeOf(handler).processChanges;

        await stageFn.apply(handler, [ {
          migrations: {
            migration_flag: false,
            disabled_flag: false
          }
        } ]);
      });

      it('should not try to update if all flags are ignored', async () => {
        const client = mockClient();
        const config = () => false;
        client.migrations.updateMigrations = () => { throw new Error('tried to update migrations'); };

        const handler = new migrations({ client, config });
        const stageFn = Object.getPrototypeOf(handler).processChanges;

        await stageFn.apply(handler, [ {
          migrations: {
            disabled_flag: false
          }
        } ]);
      });

      it('should not ignore unavailable enabled migration flags', async () => {
        const client = mockClient({ disabled_flag: true });
        const config = () => false;

        const handler = new migrations({ client, config });
        const stageFn = Object.getPrototypeOf(handler).processChanges;

        await stageFn.apply(handler, [ {
          migrations: {
            migration_flag: false,
            disabled_flag: true
          }
        } ]);
      });
    });

    describe('when AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS=true', () => {
      it('should ignore all unavailable migration flags', async () => {
        const client = mockClient();
        const config = (name) => name === 'AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS';

        const handler = new migrations({ client, config });
        const stageFn = Object.getPrototypeOf(handler).processChanges;

        await stageFn.apply(handler, [ {
          migrations: {
            migration_flag: false,
            disabled_flag: true,
            another_disabled_flag: false
          }
        } ]);
      });
    });
  });
});
