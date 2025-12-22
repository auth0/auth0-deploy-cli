import DefaultAPIHandler from './default';
import { Assets } from '../../../types';
import { Management, ManagementError } from 'auth0';

export const schema = {
  type: 'object',
  properties: {
    settings: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether or not risk assessment is enabled.',
        },
      },
      required: ['enabled'],
    },
    new_device: {
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
  required: ['settings'],
};

export type RiskAssessment = {
  settings: Management.GetRiskAssessmentsSettingsResponseContent;
  new_device?: Management.GetRiskAssessmentsSettingsNewDeviceResponseContent;
};

export default class RiskAssessmentHandler extends DefaultAPIHandler {
  existing: RiskAssessment;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'riskAssessment',
    });
  }

  async getType(): Promise<RiskAssessment> {
    if (this.existing) {
      return this.existing;
    }

    try {
      const [settings, newDeviceSettings] = await Promise.all([
        this.client.riskAssessments.settings.get(),
        this.client.riskAssessments.settings.newDevice.get().catch((err) => {
          if (err instanceof ManagementError && err?.statusCode === 404) {
            return { remember_for: 0 };
          }
          throw err;
        }),
      ]);

      const riskAssessment: RiskAssessment = {
        settings: settings,
        new_device: newDeviceSettings,
        ...(newDeviceSettings.remember_for > 0 && {
          new_device: newDeviceSettings,
        }),
      };

      this.existing = riskAssessment;
      return this.existing;
    } catch (err) {
      if (err instanceof ManagementError && err.statusCode === 404) {
        const riskAssessment: RiskAssessment = {
          settings: { enabled: false },
        };
        this.existing = riskAssessment;
        return this.existing;
      }
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { riskAssessment } = assets;

    // Non-existing section means it doesn't need to be processed
    if (!riskAssessment) {
      return;
    }

    const updates: Promise<unknown>[] = [];

    // Update main settings (enabled flag)
    updates.push(this.client.riskAssessments.settings.update(riskAssessment?.settings));

    // Update new device settings if provided
    if (riskAssessment.new_device) {
      updates.push(
        this.client.riskAssessments.settings.newDevice.update(riskAssessment.new_device)
      );
    }

    await Promise.all(updates);
    this.updated += 1;
    this.didUpdate(riskAssessment);
  }
}
