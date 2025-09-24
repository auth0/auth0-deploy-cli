import { Management } from 'auth0';
import dotProp from 'dot-prop';
import DefaultHandler, { order } from './default';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { findKeyPathWithValue } from '../../../utils';
import { isEmpty } from 'lodash';

export type Form = {
  name: string;
  body: string;
};

export type FormResponse = Management.GetFormResponseContent;

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['name'],
  },
  additionalProperties: false,
};

export default class FormsHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'forms',
      id: 'id',
      stripCreateFields: ['created_at', 'updated_at', 'submitted_at', 'embedded_at'],
      stripUpdateFields: ['created_at', 'updated_at', 'submitted_at', 'embedded_at'],
    });
  }

  objString(item): string {
    return super.objString({ id: item.id, name: item.name });
  }

  async getForms(
    forms: Array<Management.FormSummary>
  ): Promise<Management.GetFormResponseContent[]> {
    const allForms = await this.client.pool
      .addEachTask({
        data: forms,
        generator: ({ id }) =>
          this.client.forms.get(id).then((response) => {
            if (isEmpty(response)) return null;
            return response;
          }),
      })
      .promise();
    return allForms.filter((form): form is Management.GetFormResponseContent => form !== null);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const [forms, flows] = await Promise.all([
      paginate<Management.FormSummary>(this.client.forms.list, {
        paginate: true,
      }),
      paginate<Management.FlowSummary>(this.client.flows.list, {
        paginate: true,
      }),
    ]);

    // get more details for each form
    const allForms = await this.getForms(forms);

    // create a map for id to name from allFlows
    const flowIdMap = {};
    flows.forEach((f) => {
      flowIdMap[f.id] = f.name;
    });

    this.existing = await this.formateFormFlowId(allForms, flowIdMap);

    return this.existing;
  }

  async formateFormFlowId(forms, flowIdMap): Promise<Asset> {
    // replace flow_id with flow names
    await Promise.all(
      forms.map(async (form) => {
        const flows = findKeyPathWithValue(form, 'flow_id');
        await Promise.all(
          flows.map(async (f) => {
            const flowId = (dotProp.get(form, f.path) || '') as string;
            const flowName = flowIdMap[flowId];
            if (!flowName) {
              log.warn(
                `Flow: ${flowId} not found for form:${form.name}, please verify the flow id.`
              );
            } else {
              dotProp.set(form, f.path, flowName);
            }
          })
        );
        return form;
      })
    );

    return forms;
  }

  async pargeFormFlowName(forms, flowNameMap): Promise<Form[]> {
    // replace flow names with flow_id
    await Promise.all(
      forms.map(async (form) => {
        const flows = findKeyPathWithValue(form, 'flow_id');
        await Promise.all(
          flows.map(async (f) => {
            const flowName = (dotProp.get(form, f.path) || '') as string;
            const flowId = flowNameMap[flowName];
            if (!flowId) {
              log.error(
                `Flow: ${flowName} not found for form:${form.name}, please verify the flow name.`
              );
            } else {
              dotProp.set(form, f.path, flowNameMap[flowName]);
            }
          })
        );
        return form;
      })
    );

    return forms;
  }

  @order('90')
  async processChanges(assets: Assets): Promise<void> {
    const { forms } = assets;

    // Do nothing if not set
    if (!forms) return;

    const flows = await paginate<Management.FlowSummary>(this.client.flows.list, {
      paginate: true,
      include_totals: true,
    });

    // create a map for id to name from flows
    const flowNamMap = {};
    flows.forEach((f) => {
      flowNamMap[f.name] = f.id;
    });

    assets.forms = await this.pargeFormFlowName(forms, flowNamMap);

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    const changes: CalculatedChanges = {
      del: del,
      update: update,
      create: create,
      conflicts: conflicts,
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
