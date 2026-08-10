import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';
import { Action } from './actions';
import log from '../../../logger';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      status: { type: 'string', enum: ['enabled', 'disabled'] },
      subscriptions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            event_type: { type: 'string' },
          },
        },
      },
      destination: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['webhook', 'eventbridge', 'action'] },
          configuration: { type: 'object' },
        },
        required: ['type', 'configuration'],
      },
    },
    required: ['name', 'destination'],
  },
};

export type EventStream = Management.EventStreamResponseContent;

export default class EventStreamsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  private actions: Action[] | null = null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'eventStreams',
      identifiers: ['id', 'name'],
      // aws_partner_event_source is auto-populated by AWS after creation; sending it on create fails
      stripCreateFields: [
        'destination.configuration.aws_partner_event_source',
        'created_at',
        'updated_at',
      ],
      stripUpdateFields: ['created_at', 'updated_at'],
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  async getActions(): Promise<Action[]> {
    if (this.actions) return this.actions;
    this.actions = await paginate<Action>(this.client.actions.list, { paginate: true });
    return this.actions;
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) {
      return this.existing;
    }

    const eventStreams: Asset[] = [];
    let page = await this.client.eventStreams.list();
    eventStreams.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      eventStreams.push(...page.data);
    }

    // For action-destination streams, replace action_id with the action name for export
    const actions = await this.getActions();
    this.existing = eventStreams.map((stream: any) => {
      if (stream.destination?.type === 'action' && stream.destination.configuration?.action_id) {
        const action = actions.find((a) => a.id === stream.destination.configuration.action_id);
        if (action) {
          return {
            ...stream,
            destination: {
              ...stream.destination,
              configuration: {
                ...stream.destination.configuration,
                action_id: action.name,
              },
            },
          };
        }
      }
      return stream;
    });

    return this.existing;
  }

  private resolveActionId(stream: any): any {
    if (stream.destination?.type !== 'action' || !stream.destination.configuration?.action_id) {
      return stream;
    }
    const name = stream.destination.configuration.action_id;
    const action = (this.actions ?? []).find((a) => a.name === name);
    if (!action) {
      throw new Error(
        `Event stream "${stream.name}" references action "${name}" which was not found`
      );
    }
    return {
      ...stream,
      destination: {
        ...stream.destination,
        configuration: {
          ...stream.destination.configuration,
          action_id: action.id,
        },
      },
    };
  }

  @order('75')
  async processChanges(assets: Assets): Promise<void> {
    const { eventStreams } = assets;

    if (!eventStreams) return;

    if (!this.actions) {
      this.actions = await this.getActions();
    }

    const changes = await this.calcChanges(assets).then((changesResponse) => ({
      ...changesResponse,
      create: changesResponse.create.map((stream: any) => this.resolveActionId(stream)),
      update: changesResponse.update.map((stream: EventStream) => {
        const resolved = this.resolveActionId(stream);
        // A destination's type cannot be changed once an event stream is created. The API
        // rejects the destination on PATCH for eventbridge and action streams, so strip it
        // from the update payload and only apply the other mutable fields.
        if (
          resolved.destination?.type === 'eventbridge' ||
          resolved.destination?.type === 'action'
        ) {
          log.info(
            `Skipping destination update for event stream "${resolved.name}": ${resolved.destination.type} destinations cannot be changed after creation.`
          );
          const { destination: _dest, ...rest } = resolved as any;
          return rest;
        }
        return resolved;
      }),
    }));

    await super.processChanges(assets, changes);
  }
}
