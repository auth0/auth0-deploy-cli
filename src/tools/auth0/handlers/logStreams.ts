import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';
import log from '../../../logger';
import { detectInsufficientScopeError } from '../../utils';

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
    },
    required: ['name'],
  },
};

type LogStream = {
  type: 'eventbridge' | 'eventgrid' | 'datadog' | 'http' | 'splunk' | 'sumo';
  name: string;
  id: string;
  status: 'active' | 'suspended' | 'paused';
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
      stripCreateFields: ['status', 'sink.awsPartnerEventSource'],
      sensitiveFieldsToObfuscate: ['sink.httpAuthorization'],
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) {
      return this.existing;
    }

    const { data: logStreams, hadSufficientScopes, requiredScopes } = await detectInsufficientScopeError<Asset[]>(
      () => this.client.logStreams.getAll({ paginate: false })
    );
    if (!hadSufficientScopes) {
      log.warn(`Cannot process ${this.type} due to missing scopes: ${requiredScopes}`);
      return []
    }

    const nonSuspendedLogStreams = logStreams.filter(
      (logStream: LogStream) => logStream.status !== 'suspended'
    );

    this.existing = nonSuspendedLogStreams;

    return nonSuspendedLogStreams;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { logStreams } = assets;
    // Do nothing if not set
    if (!logStreams) return;
    // Figure out what needs to be updated vs created
    const changes = await this.calcChanges(assets).then((changes) => {
      return {
        ...changes,
        update: changes.update.map((update: LogStream) => {
          if (update.type === 'eventbridge' || update.type === 'eventgrid') {
            delete update.sink;
          }
          return update;
        }),
      };
    });

    await super.processChanges(assets, changes);
  }
}
