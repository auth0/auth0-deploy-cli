import { order } from './default';
import { Assets, Auth0APIClient } from '../../../types';
import { ConfigFunction } from '../../../configFactory';
import { paginate } from '../client';
import log from '../../../logger';

export const schema = {
  type: 'array',
  items: { type: 'object' },
};

/**
 * Handles full credential deletion BEFORE clients.ts (order 50) patches the client.
 *
 * Auth0 rejects a client PATCH containing token_endpoint_auth_method while that client still
 * has active credentials. By running at order 40, this handler clears credentials (and
 * client_authentication_methods) for any client where the field is absent from config, so
 * that clients.ts can safely include token_endpoint_auth_method in its PATCH.
 *
 * Partial deletion (some credentials removed, others kept) is handled by
 * ClientAuthCredentialsHandler at order 70, because those clients still have
 * client_authentication_methods present in config and clients.ts strips token_endpoint_auth_method
 * for them anyway.
 */
export default class ClientAuthCredentialsPreHandler {
  client: Auth0APIClient;
  config: ConfigFunction;
  // Same type as ClientAuthCredentialsHandler so AUTH0_EXCLUDED / AUTH0_INCLUDED_ONLY
  // applies to both handlers together without needing a separate AssetTypes entry.
  type = 'clientAuthCredentials';
  existing = null;

  constructor({ client, config }: { client: Auth0APIClient; config: ConfigFunction }) {
    this.client = client;
    this.config = config;
  }

  async getType() {
    return null;
  }

  async load() {
    return { [this.type]: null };
  }

  async validate() {
    return null;
  }

  @order('40')
  async processChanges(assets: Assets): Promise<void> {
    const { clients } = assets;
    if (!clients) return;

    const allowDelete =
      this.config('AUTH0_ALLOW_DELETE') === true || this.config('AUTH0_ALLOW_DELETE') === 'true';

    // When allowDelete is false no deletion will happen — skip entirely to avoid
    // unnecessary GET /credentials calls for every client.
    if (!allowDelete) return;

    // Only act on clients where client_authentication_methods is absent from config.
    // Absent = intentional full deletion. Clients with the field present (including partial
    // deletion) are fully handled by ClientAuthCredentialsHandler at order 70.
    const deletionCandidates = clients.filter((c) => c.client_authentication_methods === undefined);
    if (deletionCandidates.length === 0) return;

    // In directory mode client_id is stripped. Resolve names once for all candidates.
    const needsNameResolution = deletionCandidates.some((c) => !c.client_id);
    let clientIdByName = new Map<string, string>();
    if (needsNameResolution) {
      const existingClients = await paginate(this.client.clients.list, {
        paginate: true,
        is_global: false,
      });
      clientIdByName = new Map(existingClients.map((c: any) => [c.name, c.client_id]));
    }

    for (const client of deletionCandidates) {
      const clientId = client.client_id || (client.name && clientIdByName.get(client.name));
      if (!clientId) continue;

      const clientName = client.name || clientId;

      let existing: any[] = [];
      try {
        existing = (await this.client.clients.credentials.list(clientId)) as any[];
      } catch (err) {
        log.warn(
          `clientAuthCredentials: failed to list credentials for client "${clientName}": ${err}`
        );
        continue;
      }

      if (existing.length === 0) continue;

      // De-reference credentials from client_authentication_methods before deleting them —
      // Auth0 rejects deleting a credential that is still referenced.
      try {
        await (this.client.clients.update as Function)(clientId, {
          client_authentication_methods: null,
          token_endpoint_auth_method:
            (client as any).token_endpoint_auth_method || 'client_secret_post',
        });
      } catch (err) {
        log.warn(
          `clientAuthCredentials: failed to clear client_authentication_methods on client "${clientName}": ${err}`
        );
        continue;
      }

      for (const cred of existing) {
        try {
          await (this.client.clients.credentials.delete as Function)(clientId, cred.id);
          log.info(
            `clientAuthCredentials: deleted credential "${cred.name}" on client "${clientName}"`
          );
        } catch (err) {
          log.warn(
            `clientAuthCredentials: failed to delete credential "${cred.name}" on client "${clientName}": ${err}`
          );
        }
      }
    }
  }
}
