import Auth0 from './auth0';
import log from '../logger';
import { ConfigFunction } from '../configFactory';
import { Assets, Auth0APIClient } from '../types';
import { isTruthy } from '../utils';

function zeroChangeSummary(auth0: Auth0) {
  return auth0.handlers.reduce((accum, h) => {
    accum[h.type] = { deleted: 0, created: 0, updated: 0 };
    return accum;
  }, {});
}

export default async function deploy(
  assets: Assets,
  client: Auth0APIClient,
  config: ConfigFunction
) {
  // Setup log level

  const isDebug = process.env.AUTH0_DEBUG === 'true';
  log.level = isDebug ? 'debug' : 'info';

  const dryRunMode = config('AUTH0_DRY_RUN');
  // Normalize boolean true (EA compat) → 'preview'
  const effectiveMode = dryRunMode === true || dryRunMode === 'true' ? 'preview' : dryRunMode;
  const isInteractive = !!config('AUTH0_DRY_RUN_INTERACTIVE');
  const shouldApplyAfterPreview = isTruthy(config('AUTH0_DRY_RUN_APPLY'));

  log.info(
    `Getting access token for ${
      config('AUTH0_CLIENT_ID') !== undefined ? `${config('AUTH0_CLIENT_ID')}/` : ''
    }${config('AUTH0_DOMAIN')}`
  );

  const auth0 = new Auth0(client, assets, config);

  // Validate Assets
  await auth0.validate();

  if (effectiveMode === 'preview') {
    const hasChanges = await auth0.dryRun({
      interactive: isInteractive && !shouldApplyAfterPreview,
    });
    if (!shouldApplyAfterPreview || !hasChanges) {
      return zeroChangeSummary(auth0);
    }
  }

  if (dryRunMode && effectiveMode !== 'preview') {
    throw new Error(`Invalid AUTH0_DRY_RUN value: ${dryRunMode}. Use true or 'preview'.`);
  }

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
