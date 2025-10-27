import DefaultAPIHandler, { order } from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      name: { type: 'string' },
      status: { type: 'string', enum: ['active', 'paused', 'suspended'] },
      sink: { type: 'object' },
      filters: {
        type: 'array',
        items: {
          type: 'object',
        },
      },
      pii_config: {
        type: 'object',
        required: ['log_fields'],
        properties: {
          log_fields: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['first_name', 'last_name', 'username', 'email', 'phone', 'address'],
            },
          },
          method: {
            type: 'string',
            enum: ['mask', 'hash'],
            default: 'hash',
          },
          algorithm: {
            type: 'string',
            enum: ['xxhash'],
            default: 'xxhash',
          },
        },
      },
    },
    required: ['name'],
  },
};

export type LogStream = {
  type: 'eventbridge' | 'eventgrid' | 'datadog' | 'http' | 'splunk' | 'sumo';
  name: string;
  id: string;
  status?: 'active' | 'suspended' | 'paused';
  sink?: {
    [key: string]: string | boolean;
  };
};

export default class LogStreamsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'logStreams',
      stripUpdateFields: ['type'],
      stripCreateFields: ['status', 'sink.awsPartnerEventSource', 'sink.azurePartnerTopic'],
      sensitiveFieldsToObfuscate: [
        'sink.httpAuthorization',
        'sink.splunkToken',
        'sink.datadogApiKey',
      ],
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const logStreams = await this.client.logStreams.list().then((logStreamsResponse) =>
      logStreamsResponse.map((logStream) => {
        if (logStream.status === 'suspended') delete (logStream as any).status;
        return logStream;
      })
    );

    this.existing = logStreams;

    return logStreams;
  }

  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { logStreams } = assets;

    if (!logStreams) return;

    const changes = await this.calcChanges(assets).then((changesResponse) => ({
      ...changesResponse,
      update: changesResponse.update.map((update: LogStream) => {
        if (update.type === 'eventbridge' || update.type === 'eventgrid') {
          delete update.sink;
        }
        if (update.status === 'suspended') {
          // @ts-ignore because while status is usually expected for update payloads, it is ok to be omitted
          // for suspended log streams. Setting as `active` in these instances would probably be ok
          // but bit presumptuous, let suspended log streams remain suspended.
          delete update.status;
        }
        return update;
      }),
    }));

    await super.processChanges(assets, changes);
  }
}
