const filterKeys = [
  'guardian_mfa_page',
  'change_password',
  'error_page'
];

async function parse() {
  // nothing to do
  return {};
}

async function dump(mgmtClient) {
  const tenantSettings = await mgmtClient.tenant.getSettings();
  filterKeys.forEach((key) => {
    if (tenantSettings[key]) delete tenantSettings[key];
  });

  return { tenantSettings };
}


export default {
  parse,
  dump
};
