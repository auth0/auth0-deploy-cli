import * as handlers from './handlers';

const typesSchema = Object.entries(handlers).reduce((map, [ name, obj ]) => {
  map[name] = obj.schema; //eslint-disable-line
  return map;
}, {});

const excludeSchema = Object.entries(handlers).reduce((map, [ name, obj ]) => {
  if (obj.excludeSchema) {
    map[name] = obj.excludeSchema;
  }
  return map;
}, {});

export default {
  type: 'object',
  $schema: 'http://json-schema.org/draft-07/schema#',
  properties: {
    ...typesSchema,
    exclude: {
      type: 'object',
      properties: { ...excludeSchema },
      default: {}
    }
  },
  additionalProperties: false
};
