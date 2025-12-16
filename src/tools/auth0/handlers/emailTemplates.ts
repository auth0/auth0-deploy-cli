import DefaultHandler, { order } from './default';
import constants from '../../constants';
import { Assets, Asset } from '../../../types';

export const supportedTemplates = constants.EMAIL_TEMPLATES_NAMES.filter((p) =>
  p.includes('.json')
).map((p) => p.replace('.json', ''));

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      template: { type: 'string', enum: supportedTemplates },
      body: { type: 'string', default: '' },
    },
    required: ['template'],
  },
};

export default class EmailTemplateHandler extends DefaultHandler {
  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'emailTemplates',
      identifiers: ['template'],
    });
  }

  objString(item): string {
    return super.objString({
      template: item.template,
      enabled: item.enabled,
    });
  }

  async getType(): Promise<Asset> {
    const emailTemplates = await Promise.all(
      constants.EMAIL_TEMPLATES_TYPES.map(async (templateName) => {
        try {
          const template = await this.client.emailTemplates.get(templateName);
          return template;
        } catch (err) {
          if (err.statusCode === 403 && templateName === constants.EMAIL_ASYNC_APPROVAL) {
            // Ignore if feature_not_enabled
            return null;
          }

          // Ignore if not found, else throw error
          if (err.statusCode !== 404) {
            throw err;
          }
        }
        return null;
      })
    );

    const nonEmptyTemplates = emailTemplates.filter((template) => !!template);

    return nonEmptyTemplates;
  }

  async updateOrCreate(emailTemplate): Promise<void> {
    try {
      const identifierField = this.identifiers[0];

      const params = { templateName: emailTemplate[identifierField] };
      const updated = await this.client.emailTemplates.update(params.templateName, emailTemplate);
      // Remove body from the response
      const { body, ...excludedBody } = updated;
      this.didUpdate(excludedBody);
      this.updated += 1;
    } catch (err) {
      if (err.statusCode === 404) {
        // Create if it does not exist
        const created = await this.client.emailTemplates.create(emailTemplate);
        // Remove body from the response
        const { body, ...excludedBody } = created;
        this.didCreate(excludedBody);
        this.created += 1;
      } else {
        throw err;
      }
    }
  }

  // Run after email provider changes
  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { emailTemplates } = assets;

    // Do nothing if not set
    if (!emailTemplates || !emailTemplates.length) return;

    await Promise.all(
      emailTemplates.map(async (emailTemplate) => {
        await this.updateOrCreate(emailTemplate);
      })
    );
  }
}
