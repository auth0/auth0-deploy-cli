import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { stripFields } from '../../utils';
import log from '../../../logger';

export type PhoneTemplate = Management.PhoneTemplate;

export const schema = {
  type: 'array',
  description: 'List of phone notification templates',
  items: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of phone notification template',
        enum: ['otp_verify', 'otp_enroll', 'change_password', 'blocked_account', 'password_breach'],
      },
      disabled: {
        type: 'boolean',
        description: 'Whether the template is enabled (false) or disabled (true).',
      },
      content: {
        type: 'object',
        description: 'Content of the phone template',
        properties: {
          syntax: {
            type: 'string',
            description: 'Syntax used for the template content',
          },
          from: {
            type: 'string',
            description:
              'Default phone number to be used as "from" when sending a phone notification',
          },
          body: {
            type: 'object',
            description: 'Body content of the phone template',
            properties: {
              text: {
                type: 'string',
                description: 'Content of the phone template for text notifications',
              },
              voice: {
                type: 'string',
                description: 'Content of the phone template for voice notifications',
              },
            },
          },
        },
      },
    },
  },
};

export default class PhoneTemplatesHandler extends DefaultHandler {
  existing: PhoneTemplate[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'phoneTemplates',
      identifiers: ['type'],
      stripCreateFields: ['channel', 'customizable', 'tenant'],
      stripUpdateFields: ['channel', 'customizable', 'tenant', 'type'],
    });
  }

  objString(template): string {
    return super.objString({ type: template.type, disabled: template.disabled });
  }

  async getType(): Promise<PhoneTemplate[]> {
    if (this.existing) {
      return this.existing;
    }

    const response = await this.client.branding.phone.templates.list();
    this.existing = response.templates ?? [];

    return this.existing;
  }

  @order('65')
  async processChanges(assets: Assets): Promise<void> {
    const { phoneTemplates } = assets;

    if (!phoneTemplates) return;

    const { del, update, create } = await this.calcChanges(assets);

    log.debug(
      `Start processChanges for phone templates [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
    );

    if (del.length > 0) {
      await this.deletePhoneTemplates(del);
    }

    // On newly created tenants the phone templates returned by the API have no
    // ID until they are explicitly created. calcChanges matches assets by `type`
    // and routes them all to `update`, but PATCH requires an ID. Split out the
    // templates whose existing counterpart has no ID yet and create them instead.
    const missingId: CalculatedChanges['update'] = [];
    const hasId: CalculatedChanges['update'] = [];
    update.forEach((template) => {
      const existing = this.existing?.find((t) => t.type === template.type);
      if (existing?.id) {
        hasId.push(template);
      } else {
        missingId.push(template);
      }
    });

    const toCreate = [...create, ...missingId];

    if (toCreate.length > 0) {
      await this.createPhoneTemplates(toCreate);
    }

    if (hasId.length > 0) {
      await this.updatePhoneTemplates(hasId);
    }
  }

  async createPhoneTemplate(template): Promise<Asset> {
    // The create endpoint only accepts type/disabled/content; strip read-only
    // fields (channel, customizable, tenant) that the API would reject.
    const createPayload = stripFields(template, this.stripCreateFields);
    // `content.from` is optional but the API rejects an empty string. Fresh
    // tenants export it as '', so drop it when blank to let the create succeed.
    if (createPayload.content && !createPayload.content.from) {
      delete createPayload.content.from;
    }
    try {
      const created = await this.client.branding.phone.templates.create(createPayload);
      return created;
    } catch (err) {
      // A 409 means the template already exists on the tenant (it was created
      // between our list call and this create, or the list endpoint didn't
      // surface its ID). Re-fetch to pick up the ID and fall back to an update.
      if (err.statusCode === 409) {
        log.debug(`Phone template type '${template.type}' already exists, falling back to update`);
        const response = await this.client.branding.phone.templates.list();
        this.existing = response.templates ?? [];
        return this.updatePhoneTemplate(template);
      }
      throw err;
    }
  }

  async createPhoneTemplates(creates: CalculatedChanges['create']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item) =>
          this.createPhoneTemplate(item)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updatePhoneTemplate(template): Promise<Asset> {
    const { type } = template;

    // Find the existing template to get its id
    const existing = this.existing?.find((t) => t.type === type);
    if (!existing?.id) {
      log.warn(
        `Skipping update for phone template type '${type}' as unable to find existing template ID`
      );
      return template;
    }

    // stripUpdateFields does not support in sub modules
    const stripUpdateFields = ['content.syntax'];
    log.debug(`Stripping ${this.type} create-only fields ${JSON.stringify(stripUpdateFields)}`);

    const updatePayload: Management.UpdatePhoneTemplateRequestContent = {
      content: {
        body: {
          text: template.content?.body?.text,
          voice: template.content?.body?.voice,
        },
      },
      disabled: template.disabled,
    };

    // `content.from` is optional but the API rejects an empty string, which is
    // what fresh tenants export. Only include it when it has a value.
    if (template.content?.from) {
      updatePayload.content!.from = template.content.from;
    }

    const updated = await this.client.branding.phone.templates.update(existing.id, updatePayload);
    return updated;
  }

  async updatePhoneTemplates(updates: CalculatedChanges['update']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item) =>
          this.updatePhoneTemplate(item)
            .then((data) => {
              this.didUpdate(data);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deletePhoneTemplate(template): Promise<void> {
    if (!template.id) {
      throw new Error(
        `Unable to find phone template id for type ${template.type} when trying to delete`
      );
    }
    await this.client.branding.phone.templates.delete(template.id);
  }

  async deletePhoneTemplates(data: Asset[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item) =>
            this.deletePhoneTemplate(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following phone templates should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }
}
