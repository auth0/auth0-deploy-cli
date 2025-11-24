import DefaultAPIHandler from './default';
import { Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    remember_for: {
      type: 'number',
      description: 'Length of time to remember devices for, in days.',
    },
  },
  required: ['remember_for'],
};

export type RiskAssessmentsNewDeviceSettings = {
  remember_for: number;
};

export default class RiskAssessmentsNewDeviceHandler extends DefaultAPIHandler {
  existing: RiskAssessmentsNewDeviceSettings | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'riskAssessmentsNewDevice',
    });
  }

  async getType(): Promise<RiskAssessmentsNewDeviceSettings> {
    if (this.existing) {
      return this.existing;
    }

    try {
      const { data } = await this.client.riskAssessments.getNewDeviceSettings();
      this.existing = data;
      return data;
    } catch (err) {
      if (err.statusCode === 404) return { remember_for: 0 };
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { riskAssessmentsNewDevice } = assets;

    // Non-existing section means it doesn't need to be processed
    if (!riskAssessmentsNewDevice) {
      return;
    }

    try {
      // Validate that remember_for property exists
      const settings: RiskAssessmentsNewDeviceSettings = {
        remember_for: riskAssessmentsNewDevice.remember_for as number,
      };

      await this.client.riskAssessments.updateNewDeviceSettings(settings);
      this.updated += 1;
      this.didUpdate(settings);
    } catch (err) {
      throw err;
    }
  }
}
