import Auth0 from './auth0';
import log from '../logger';
import { ConfigFunction } from '../configFactory';
import { Assets, Auth0APIClient } from '../types';

export default async function deploy(
  assets: Assets,
  client: Auth0APIClient,
  config: ConfigFunction
) {
  // Setup log level
  log.level = process.env.AUTH0_DEBUG === 'true' ? 'debug' : 'info';

  log.info(
    `Getting access token for ${
      config('AUTH0_CLIENT_ID') !== undefined ? `${config('AUTH0_CLIENT_ID')}/` : ''
    }${config('AUTH0_DOMAIN')}`
  );

  const auth0 = new Auth0(client, assets, config);

  // Validate Assets
  await auth0.validate();

  // Process changes
  await auth0.processChanges();

  return auth0.handlers.reduce((accum, h) => {
    accum[h.type] = {
      deleted: h.deleted,
      created: h.created,
      updated: h.updated,
    };
    return accum;
  }, {});
}
