import path from 'path';
import fs from 'fs-extra';

import { loadFilesByKey } from '../../../utils';
import log from '../../../logger';

export const pageNameMap = {
  guardian_mfa_page: 'guardian_multifactor',
  change_password: 'password_reset',
  error_page: 'error_page'
};


async function parse(context) {
  // Load the HTML file for each page

  const pages = context.assets.pages || [];

  return {
    pages: [
      ...pages.map(page => loadFilesByKey(page, context.basePath, [ 'html' ], context.mappings))
    ]
  };
}


async function dump(mgmtClient, context) {
  let pages = [];

  // Login page is handled via the global client
  const globalClient = await mgmtClient.clients.getAll({ is_global: true });
  if (!globalClient[0]) {
    throw new Error('Unable to find global client id when trying to dump the login page');
  }

  pages.push({
    name: 'login',
    enabled: globalClient[0].custom_login_page_on,
    html: globalClient[0].custom_login_page
  });

  const tenantSettings = await mgmtClient.tenant.getSettings();

  Object.entries(pageNameMap).forEach(([ key, name ]) => {
    const page = tenantSettings[key];
    if (tenantSettings[key]) {
      pages.push({
        ...page,
        name
      });
    }
  });

  if (pages.length > 0) {
    // Create Pages folder
    const pagesFolder = path.join(context.basePath, 'pages');
    fs.ensureDirSync(pagesFolder);

    pages = pages.map((page) => {
      // Dump html to file
      const htmlFile = path.join(pagesFolder, `${page.name}.html`);
      log.info(`Writing ${htmlFile}`);
      fs.writeFileSync(htmlFile, page.html);
      return {
        ...page,
        html: htmlFile
      };
    });
  }

  return { pages };
}


export default {
  parse,
  dump
};
