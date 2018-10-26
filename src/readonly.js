import dotProp from 'dot-prop';

// Filter out known read only fields during dump
const readOnly = {
  connections: [
    'provisioning_ticket_url',
    'realms'
  ],
  tenant: [
    'sandbox_versions_available',
    'flags.allow_changing_enable_sso',
    'flags.disable_impersonation'
  ],
  clients: [
    'callback_url_template',
    'signing_keys',
    'global',
    'tenant',
    'custom_login_page_preview'
  ]
};

function deleteKeys(obj, keys) {
  const newObj = { ...obj };
  keys.forEach(k => dotProp.delete(newObj, k));
  return newObj;
}

export default function cleanAssets(assets) {
  const cleaned = { ...assets };

  Object.entries(readOnly).forEach(([ name, fields ]) => {
    const obj = cleaned[name];
    if (!obj) return;

    if (Array.isArray(obj)) {
      cleaned[name] = obj.map(o => deleteKeys(o, fields));
    } else {
      cleaned[name] = deleteKeys(cleaned[name], fields);
    }
  });

  return cleaned;
}
