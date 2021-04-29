import dotProp from 'dot-prop';
import _ from 'lodash';
// Filter out known read only fields during dump
const readOnly = {
  guardianFactors: [
    'trial_expired'
  ],
  connections: [
    'provisioning_ticket_url',
    'realms'
  ],
  databases: [
    'options.configuration'
  ],
  tenant: [
    'sandbox_version',
    'sandbox_versions_available',
    'flags.allow_changing_enable_sso',
    'flags.enable_sso',
    'flags.disable_impersonation',
    'flags.remove_stale_idp_attributes'
  ],
  clients: [
    'client_secret',
    'callback_url_template',
    'signing_keys',
    'global',
    'tenant',
    'custom_login_page_preview',
    'config_route',
    'owners'
  ]
};

function getExcludedFields(config) {
  const strippedFields = { ...readOnly };

  let { EXCLUDED_PROPS: excluded, INCLUDED_PROPS: included } = config;
  if (typeof excluded !== 'object') excluded = {};
  if (typeof included !== 'object') included = {};

  Object.entries(excluded).forEach(([ name, fields ]) => {
    // Do not allow same field to be included and excluded at the same time
    const intersections = fields.filter(field => included[name] && included[name].includes(field));
    if (intersections.length > 0) {
      throw new Error(`EXCLUDED_PROPS should NOT have any intersections with INCLUDED_PROPS. Intersections found: ${name}: ${intersections.join(', ')}`);
    }
    strippedFields[name] = (strippedFields[name] || []).concat(fields);
  });

  Object.entries(included).forEach(([ name, fields ]) => {
    if (strippedFields[name]) {
      strippedFields[name] = strippedFields[name].filter(field => !fields.includes(field));
    }
  });

  return strippedFields;
}

function deleteKeys(obj, keys) {
  const newObj = { ...obj };
  keys.forEach(k => dotProp.delete(newObj, k));
  return newObj;
}

export default function cleanAssets(assets, config) {
  const cleaned = { ...assets };
  const excludedFields = getExcludedFields(config);

  Object.entries(excludedFields).forEach(([ name, fields ]) => {
    const obj = cleaned[name];
    if (!obj) return;

    if (Array.isArray(obj)) {
      cleaned[name] = obj.map(o => deleteKeys(o, fields));
    } else {
      cleaned[name] = deleteKeys(cleaned[name], fields);
    }
  });

  return _.pickBy(cleaned, _.identity);
}
