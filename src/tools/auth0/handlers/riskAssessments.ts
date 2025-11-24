import DefaultAPIHandler from './default';
import { Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether or not risk assessment is enabled.',
    },
  },
  required: ['enabled'],
};

export type RiskAssessmentsSettings = {
  enabled: boolean;
};

export default class RiskAssessmentsHandler extends DefaultAPIHandler {
  existing: RiskAssessmentsSettings | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'riskAssessments',
    });
  }

  async getType(): Promise<RiskAssessmentsSettings> {
    if (this.existing) {
      return this.existing;
    }

    try {
      const { data } = await this.client.riskAssessments.getSettings();
      this.existing = data;
      return data;
    } catch (err) {
      if (err.statusCode === 404) return { enabled: false };
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { riskAssessments } = assets;

    // Non-existing section means it doesn't need to be processed
    if (!riskAssessments) {
      return;
    }

    try {
      // Validate that enabled property exists
      const settings: RiskAssessmentsSettings = {
        enabled: riskAssessments.enabled as boolean,
      };

      await this.client.riskAssessments.updateSettings(settings);
      this.updated += 1;
      this.didUpdate(settings);
    } catch (err) {
      throw err;
    }
  }
}
