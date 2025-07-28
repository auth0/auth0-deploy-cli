import {
  GetFlows200ResponseOneOfInner,
  GetForms200ResponseOneOfInner,
  PostForms201Response,
} from 'auth0';
import dotProp from 'dot-prop';
import { isEmpty } from 'lodash';
import DefaultHandler, { order } from './default';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { findKeyPathWithValue } from '../../../utils';
import { isDryRun } from '../../utils';

export type Form = {
  name: string;
  body: string;
};

export type FormResponse = PostForms201Response;

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

  async getForms(forms: Array<PostForms201Response>): Promise<PostForms201Response[]> {
    const allForms = await this.client.pool
      .addEachTask({
        data: forms,
        generator: ({ id }) =>
          this.client.forms.get({ id: id }).then((response) => {
            if (isEmpty(response?.data)) return null;
            return response.data;
          }),
      })
      .promise();
    return allForms.filter((form): form is PostForms201Response => form !== null);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const [forms, flows] = await Promise.all([
      paginate<GetForms200ResponseOneOfInner>(this.client.forms.getAll, {
        paginate: true,
        include_totals: true,
      }),
      paginate<GetFlows200ResponseOneOfInner>(this.client.flows.getAll, {
        paginate: true,
        include_totals: true,
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

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    if (
      isDryRun(this.config) &&
      create.length === 0 &&
      update.length === 0 &&
      del.length === 0 &&
      conflicts.length === 0
    ) {
      log.debug(
        `Start processChanges for forms [delete:${del.length}] [update:${update.length}] [create:${create.length}] [conflicts:${conflicts.length}]`
      );
      return;
    }

    const flows = await paginate<GetFlows200ResponseOneOfInner>(this.client.flows.getAll, {
      paginate: true,
      include_totals: true,
    });

    // create a map for id to name from flows
    const flowNamMap = {};
    flows.forEach((f) => {
      flowNamMap[f.name] = f.id;
    });

    const changes: CalculatedChanges = {
      del: await this.pargeFormFlowName(del, flowNamMap),
      update: await this.pargeFormFlowName(update, flowNamMap),
      create: await this.pargeFormFlowName(create, flowNamMap),
      conflicts: await this.pargeFormFlowName(conflicts, flowNamMap),
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
