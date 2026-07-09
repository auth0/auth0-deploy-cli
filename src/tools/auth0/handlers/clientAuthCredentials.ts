import { order } from './default';
import { Assets, Auth0APIClient } from '../../../types';
import { ConfigFunction } from '../../../configFactory';
import { paginate } from '../client';
import log from '../../../logger';

export const schema = {
  type: 'array',
  items: { type: 'object' },
};

const CREDENTIAL_TYPE_TO_METHOD: Record<string, string> = {
  public_key: 'private_key_jwt',
  x509_cert: 'self_signed_tls_client_auth',
  cert_subject_dn: 'tls_client_auth',
};

export default class ClientAuthCredentialsHandler {
  client: Auth0APIClient;
  config: ConfigFunction;
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
    log.info(`Retrieving ${this.type} data from Auth0`);
    return { [this.type]: null };
  }

  async validate() {
    return null;
  }

  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { clients } = assets;
    if (!clients) return;

    const allowDelete =
      this.config('AUTH0_ALLOW_DELETE') === true || this.config('AUTH0_ALLOW_DELETE') === 'true';

    const needsNameResolution = clients.some((c) => !c.client_id);

    // Only fetch all clients when directory mode has stripped client_id (null) from any entry
    // that also has client_authentication_methods — avoids an extra API call in the common case.
    let clientIdByName = new Map<string, string>();
    if (needsNameResolution) {
      const existingClients = await paginate(this.client.clients.list, {
        paginate: true,
        is_global: false,
      });
      clientIdByName = new Map(existingClients.map((c: any) => [c.name, c.client_id]));
    }

    for (const client of clients) {
      const clientId = client.client_id || (client.name && clientIdByName.get(client.name));
      if (!clientId) continue;
      client.client_id = clientId;

      const clientName = client.name || clientId;

      // Collect all desired credentials across all auth methods (only pem-bearing entries)
      const desired: { name: string; pem?: string; credential_type: string; method: string }[] = [];

      if (client.client_authentication_methods) {
        for (const [methodKey, methodVal] of Object.entries(
          client.client_authentication_methods as Record<string, any>
        )) {
          const credentials: any[] = methodVal?.credentials || [];
          for (const cred of credentials) {
            if (!cred.pem) continue;
            desired.push({
              name: cred.name,
              pem: cred.pem,
              credential_type: cred.credential_type || this.inferCredentialType(methodKey),
              method: methodKey,
            });
          }
        }
      }

      // When client_authentication_methods is present but no credential has a pem,
      // skip reconciliation — pem is the opt-in signal and a plain export→deploy must
      // never delete credentials. When absent entirely, fall through to the delete path
      // so that removing the field from config is treated as intentional deletion.
      if (desired.length === 0 && client.client_authentication_methods) continue;

      let existing: any[] = [];
      try {
        existing = (await this.client.clients.credentials.list(clientId)) as any[];
      } catch (err) {
        log.warn(
          `clientAuthCredentials: failed to list credentials for client "${clientName}": ${err}`
        );
        continue;
      }

      // Warn if duplicate names exist in Auth0 — we can't match safely
      const existingNames = existing.map((c) => c.name);
      const duplicateNames = existingNames.filter((n, i) => existingNames.indexOf(n) !== i);
      if (duplicateNames.length > 0) {
        log.warn(
          `clientAuthCredentials: client "${clientName}" has duplicate credential names in Auth0 [${duplicateNames.join(
            ', '
          )}] — skipping credential reconciliation for this client`
        );
        continue;
      }

      const existingByName = new Map(existing.map((c) => [c.name, c]));
      const desiredNames = new Set(desired.map((d) => d.name));

      const toCreate = desired.filter((d) => !existingByName.has(d.name));
      const toDelete = existing.filter((e) => !desiredNames.has(e.name));

      // Creates first — Auth0 allows max 2 credentials; both must exist simultaneously during rotation
      // Track name→id so we can correctly attribute each created credential to its method later.
      const createdIdByName = new Map<string, string>();
      for (const cred of toCreate) {
        try {
          const created = await (this.client.clients.credentials.create as Function)(clientId, {
            name: cred.name,
            pem: cred.pem,
            credential_type: cred.credential_type,
          });
          log.info(
            `clientAuthCredentials: created credential "${cred.name}" on client "${clientName}"`
          );
          createdIdByName.set(cred.name, created.id);
        } catch (err) {
          log.warn(
            `clientAuthCredentials: failed to create credential "${cred.name}" on client "${clientName}": ${err}`
          );
        }
      }

      // Re-wire client_authentication_methods with final IDs (kept + newly created).
      // This must happen BEFORE deletes — Auth0 rejects deleting a credential that
      // is still referenced in client_authentication_methods.
      const keptIds = existing.filter((e) => desiredNames.has(e.name)).map((e) => e.id);
      const createdIds = [...createdIdByName.values()];
      const finalIds = [...keptIds, ...createdIds];

      let updatedAuthMethods: Record<string, any> | null = null;
      if (finalIds.length > 0) {
        // Build method→ids map. For kept credentials use Auth0's stored type to infer method;
        // for created credentials use the method from the user's config entry (by name).
        const methodToIds: Record<string, string[]> = {};
        for (const id of finalIds) {
          const fromExisting = existing.find((e) => e.id === id);
          const createdName = [...createdIdByName.entries()].find(([, cid]) => cid === id)?.[0];
          const fromDesired = createdName ? desired.find((d) => d.name === createdName) : undefined;
          const methodKey =
            (fromExisting && this.inferMethodFromType(fromExisting.credential_type)) ||
            (fromDesired && fromDesired.method) ||
            Object.keys(client.client_authentication_methods as object)[0];
          if (!methodToIds[methodKey]) methodToIds[methodKey] = [];
          methodToIds[methodKey].push(id);
        }
        updatedAuthMethods = {};
        for (const [methodKey, ids] of Object.entries(methodToIds)) {
          updatedAuthMethods[methodKey] = { credentials: ids.map((id) => ({ id })) };
        }
      }

      // Always update client_authentication_methods before deletes:
      // - When finalIds > 0: re-wire to the remaining credentials
      // - When finalIds === 0 but toDelete > 0: set to null so Auth0 de-references them first
      if (finalIds.length > 0 || toDelete.length > 0) {
        try {
          const payload: Record<string, any> = {
            client_authentication_methods: updatedAuthMethods ?? null,
          };
          // Auth0 requires token_endpoint_auth_method when clearing client_authentication_methods.
          // Use the value from the client config if available, otherwise fall back to the default.
          if (!updatedAuthMethods) {
            payload.token_endpoint_auth_method =
              (client as any).token_endpoint_auth_method || 'client_secret_post';
          }
          await (this.client.clients.update as Function)(clientId, payload);
          log.info(
            `clientAuthCredentials: updated client_authentication_methods on client "${clientName}"`
          );
        } catch (err) {
          log.warn(
            `clientAuthCredentials: failed to update client_authentication_methods on client "${clientName}": ${err}`
          );
        }
      }

      // Deletes last — after client_authentication_methods no longer references them
      if (toDelete.length > 0) {
        if (!allowDelete) {
          log.warn(
            `clientAuthCredentials: the following credentials on client "${clientName}" would be deleted but AUTH0_ALLOW_DELETE is not set:\n${toDelete
              .map((c) => `  ${c.name} (${c.id})`)
              .join('\n')}`
          );
        } else {
          for (const cred of toDelete) {
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
  }

  private inferCredentialType(methodKey: string): string {
    const map: Record<string, string> = {
      private_key_jwt: 'public_key',
      self_signed_tls_client_auth: 'x509_cert',
      tls_client_auth: 'cert_subject_dn',
    };
    return map[methodKey] || 'public_key';
  }

  private inferMethodFromType(credentialType: string): string {
    return CREDENTIAL_TYPE_TO_METHOD[credentialType] || 'private_key_jwt';
  }
}
