import fs from 'fs-extra';

import log from '../../../logger';
import { clearTenantFlags } from '../../../utils';

function getPages(context) {
  const { pages } = context.assets;
  if (!pages) return undefined;

  return pages.reduce((r, p) => {
    const { name, ...page } = p;

    if (name !== 'error_page' || page.html !== undefined) {
      // Dump template html to file
      const htmlFile = `./${name}.html`;
      log.info(`Writing ${htmlFile}`);
      fs.writeFileSync(htmlFile, page.html);
      page.html = `\${file("./${name}.html")}`;
    }

    r[name] = page;
    return r;
  }, {});
}

async function dump(context) {
  const tenant = { ...(context.assets.tenant || {}) };

  clearTenantFlags(tenant);

  const pages = getPages(context);

  return {
    type: 'auth0_tenant',
    name: 'tenant',
    content: {
      ...tenant,
      ...pages
    },
  };
}

export default {
  dump
};
