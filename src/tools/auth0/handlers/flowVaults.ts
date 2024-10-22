import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';
import constants from '../../constants';

export type FlowVaultConnection = {
  name: string;
  app_id: string;
  environment: string;
  setup: object;
  account_name: string;
  ready: string;
};

export type FlowVault = {
  connections: FlowVaultConnection[];
};

export const schema = {
  type: 'array',
  items: {
    type: 'array',
    properties: {
      connections: {
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            app_id: { type: 'string', enum: constants.CONNECTION_APP_ID },
            environment: { type: 'string' },
            setup: { type: 'object' },
            account_name: { type: 'string' },
            ready: { type: 'string' },
          },
        },
        required: ['name', 'app_id'],
      },
    },
  },
  required: ['connections'],
  additionalProperties: false,
};

export default class FlowVaultHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'flowVaults',
      id: 'id',
    });
  }

  async getType(): Promise<DefaultHandler['existing']> {
    if (this.existing) {
      return this.existing;
    }
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {}
}
