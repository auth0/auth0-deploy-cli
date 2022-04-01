import DefaultHandler, { order } from './default';
import log from '../../logger';
import { Asset, Assets } from '../../../types'

export const schema = {
  type: 'object',
  additionalProperties: { type: 'boolean' }
};

export default class MigrationsHandler extends DefaultHandler {
  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'migrations'
    });
  }

  //TODO: standardize empty object literal with more intentional empty indicator
  async getType(): Promise<Asset[] | {}> {
    try {
      const migrations = await this.client.migrations.getMigrations();
      return migrations.flags;
    } catch (err) {
      if (err.statusCode === 404) return {};
      throw err;
    }
  }

  // Run at the end since switching a flag will depend on other applying other changes
  @order('150')
  async processChanges(assets: Assets): Promise<void> {
    const { migrations } = assets;

    if (migrations && Object.keys(migrations).length > 0) {
      const flags = await this.removeUnavailableMigrations(migrations);

      if (Object.keys(flags).length > 0) {
        await this.client.migrations.updateMigrations({ flags });
        this.updated += 1;
        this.didUpdate(flags);
      }
    }
  }

  logUnavailableMigrations(ignoreUnavailableMigrations: boolean, ignoredMigrations: string[]) {
    if (ignoreUnavailableMigrations) {
      log.info(`The following migrations are not available '${ignoredMigrations.join(',')}'. The migrations will be ignored because you have AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS=true in your configuration.`);
    } else {
      log.warn(`The following disabled migrations are not available '${ignoredMigrations.join(',')}'. The migrations will be ignored, remove the migrations to avoid future warnings.`);
    }
  }

  async removeUnavailableMigrations(migrations: Asset[]): Promise<Asset[]> {
    const flags = { ...migrations };
    const ignoreUnavailableMigrations = !!this.config('AUTH0_IGNORE_UNAVAILABLE_MIGRATIONS');
    const existingMigrations = await this.getType();
    const unavailableMigrations = Object.keys(flags).filter((flag) => !(flag in existingMigrations));
    const ignoredMigrations = unavailableMigrations.filter((flag) => ignoreUnavailableMigrations || flags[flag] === false);

    if (ignoredMigrations.length > 0) {
      this.logUnavailableMigrations(ignoreUnavailableMigrations, ignoredMigrations);
      ignoredMigrations.forEach((flag) => delete flags[flag]);
    }
    return flags;
  }
}
