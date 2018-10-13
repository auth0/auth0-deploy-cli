const filterKeys = [
  'guardian_mfa_page',
  'change_password',
  'error_page'
];

async function parse(context) {
  // nothing to do, set default if empty
  return { tenant: context.assets.tenant || {} };
}

async function dump(mgmtClient) {
  const tenant = await mgmtClient.tenant.getSettings();
  filterKeys.forEach((key) => {
    if (tenant[key]) delete tenant[key];
  });

  return { tenant };
}


export default {
  parse,
  dump
};
