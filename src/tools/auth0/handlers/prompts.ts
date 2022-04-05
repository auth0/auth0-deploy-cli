//@ts-nocheck because prompts haven't been fully implemented in this codebase yet
import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';

export const schema = { type: 'object' };

export default class PromptsHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'prompts',
    });
  }

  async getType(): Promise<Asset[]> {
    // in case client version does not support branding
    if (!this.client.prompts || typeof this.client.prompts.getSettings !== 'function') {
      return {};
    }

    try {
      return await this.client.prompts.getSettings();
    } catch (err) {
      if (err.statusCode === 404) return {};
      if (err.statusCode === 501) return {};

      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { prompts } = assets;

    // Do nothing if not set
    if (!prompts || !Object.keys(prompts).length) return;

    await this.client.prompts.updateSettings({}, prompts);
    this.updated += 1;
    this.didUpdate(prompts);
  }
}
