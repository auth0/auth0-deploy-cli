import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import log from '../../../logger';

export type NetworkAclKey = Management.NetworkAclKey & { value?: string };

export const schema = {
  type: 'array',
  description: 'List of Network ACL keys for HMAC signature verification',
  items: {
    type: 'object',
    required: ['name', 'alg'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string', maxLength: 255 },
      alg: { type: 'string', enum: ['hmac-sha256'] },
      // value is write-only and never returned by the API.
      // Provide it at deploy time via keyword replacement (e.g. ##HMAC_KEY_VALUE##).
      // It is not exported and is omitted from exported configs.
      value: { type: 'string' },
      fingerprint: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export default class NetworkACLKeysHandler extends DefaultAPIHandler {
  existing: NetworkAclKey[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'networkACLKeys',
      id: 'id',
      identifiers: ['name'],
      stripCreateFields: ['id', 'fingerprint', 'created_at', 'updated_at', 'value'],
      stripUpdateFields: ['id', 'fingerprint', 'created_at', 'updated_at', 'value'],
    });
  }

  objString(key: NetworkAclKey): string {
    return super.objString({ name: key.name, alg: key.alg });
  }

  async getType(): Promise<Asset | null> {
    if (this.existing) return this.existing;

    try {
      // Not paginated — tenant cap is 10 keys. Returns { keys: [...] }.
      const result = await this.client.keys.networkAcls.list();
      this.existing = result.keys as NetworkAclKey[];
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (err.statusCode === 403) {
        log.debug(
          'Network ACL key management is not enabled for this tenant. Please verify `scope` or contact Auth0 support.'
        );
        return null;
      }
      throw err;
    }
  }

  @order(60)
  async processChanges(assets: Assets): Promise<void> {
    const { networkACLKeys } = assets;

    // Do nothing if not set
    if (!networkACLKeys) return;

    const { del, create } = await this.calcChanges(assets);
    // Keys are immutable after creation — there is no update operation.
    // A detected "update" (same name, different config) is a no-op: the existing key is kept as-is.

    log.debug(
      `Start processChanges for networkACLKeys [delete:${del.length}] [create:${create.length}]`
    );

    await Promise.all([this.deleteNetworkACLKeys(del), this.createNetworkACLKeys(create)]);
  }

  async createNetworkACLKey(key: NetworkAclKey): Promise<void> {
    if (!key.value) {
      log.warn(
        `Skipping creation of Network ACL key "${key.name}": ` +
          `'value' is required to create a key but is not present in the config. ` +
          `Supply the key material via keyword replacement (e.g. ##HMAC_KEY_VALUE##) or create the key out-of-band.`
      );
      return;
    }

    await this.client.keys.networkAcls.create({
      name: key.name,
      alg: key.alg as Management.NetworkAclKeyAlgorithmEnum,
      value: key.value,
    });
  }

  async createNetworkACLKeys(creates: CalculatedChanges['create']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item: NetworkAclKey) =>
          this.createNetworkACLKey(item)
            .then(() => {
              this.didCreate(item);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deleteNetworkACLKey(key: NetworkAclKey): Promise<void> {
    if (!key.id) {
      throw new Error(`Missing id for ${this.type} ${this.objString(key)}`);
    }
    // TODO: remove `as any` cast when node-auth0 adds delete() to NetworkAclsClient
    await (this.client.keys.networkAcls as any).delete(key.id);
  }

  async deleteNetworkACLKeys(data: Asset[]): Promise<void> {
    if (!data || data.length === 0) return;

    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item: NetworkAclKey) =>
            this.deleteNetworkACLKey(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                if (err.statusCode === 409) {
                  throw new Error(
                    `Cannot delete Network ACL key "${item.name}" — it is still referenced by one or more ACL rules. ` +
                      `Remove the key reference from all ACL rules first.\n${err}`
                  );
                }
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following ${
        this.type
      } should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i as NetworkAclKey)).join('\n')}`);
    }
  }
}
