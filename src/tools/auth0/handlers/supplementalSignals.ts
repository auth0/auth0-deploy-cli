import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    akamai_enabled: {
      type: 'boolean',
      description: 'Enable Akamai supplemental signals integration',
    },
  },
  additionalProperties: false,
};

export type SupplementalSignals = Management.GetSupplementalSignalsResponseContent;

export default class SupplementalSignalsHandler extends DefaultHandler {
  existing: SupplementalSignals;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'supplementalSignals',
    });
  }

  async getType(): Promise<Asset> {
    const supplementalSignals = await this.client.supplementalSignals.get();
    this.existing = supplementalSignals;
    return supplementalSignals;
  }

  async validate(assets: Assets): Promise<void> {
    const { supplementalSignals } = assets;

    if (!supplementalSignals) return;
  }

  @order('100')
  async processChanges(assets: Assets): Promise<void> {
    const { supplementalSignals } = assets;

    if (!supplementalSignals) return;

    if (supplementalSignals && Object.keys(supplementalSignals).length > 0) {
      await this.client.supplementalSignals.patch(
        supplementalSignals as Management.UpdateSupplementalSignalsRequestContent
      );
      this.updated += 1;
      this.didUpdate(supplementalSignals);
    }
  }
}
