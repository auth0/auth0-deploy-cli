import DefaultAPIHandler from './default';
import { Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether or not risk assessment is enabled.',
    },
    newDevice: {
      type: 'object',
      properties: {
        remember_for: {
          type: 'number',
          description: 'Length of time to remember devices for, in days.',
        },
      },
      required: ['remember_for'],
    },
  },
  required: ['enabled'],
};

export type RiskAssessmentsSettings = {
  enabled: boolean;
  newDevice?: {
    remember_for: number;
  };
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
      const [settings, newDeviceSettings] = await Promise.all([
        this.client.riskAssessments.getSettings(),
        this.client.riskAssessments.getNewDeviceSettings().catch((err) => {
          if (err.statusCode === 404) return { data: { remember_for: 0 } };
          throw err;
        }),
      ]);

      this.existing = {
        enabled: settings.data.enabled,
        ...(newDeviceSettings.data.remember_for > 0 && {
          newDevice: {
            remember_for: newDeviceSettings.data.remember_for,
          },
        }),
      };
      return this.existing;
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
      const updates: Promise<unknown>[] = [];

      // Update main settings (enabled flag)
      const settings = {
        enabled: riskAssessments.enabled as boolean,
      };
      updates.push(this.client.riskAssessments.updateSettings(settings));

      // Update new device settings if provided
      if (riskAssessments.newDevice) {
        const newDeviceSettings = {
          remember_for: riskAssessments.newDevice.remember_for as number,
        };
        updates.push(this.client.riskAssessments.updateNewDeviceSettings(newDeviceSettings));
      }

      await Promise.all(updates);
      this.updated += 1;
      this.didUpdate(riskAssessments);
    } catch (err) {
      throw err;
    }
  }
}
