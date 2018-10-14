import path from 'path';
import fs from 'fs-extra';

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
      ...pages.map(page => ({
        ...page,
        html: context.loadFile(page.html)
      }))
    ]
  };
}


async function dump(context) {
  let pages = context.assets.pages || [];

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
