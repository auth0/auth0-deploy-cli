import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedPages =
  | {
      pages: unknown[];
    }
  | {};

async function parse(context: YAMLContext): Promise<ParsedPages> {
  // Load the HTML file for each page

  if (!context.assets.pages) return {};

  return {
    pages: [
      ...context.assets.pages.map((page) => ({
        ...page,
        html: page.html ? context.loadFile(page.html) : '',
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedPages> {
  let pages = [...(context.assets.pages || [])];

  if (pages.length > 0) {
    // Create Pages folder
    const pagesFolder = path.join(context.basePath, 'pages');
    fs.ensureDirSync(pagesFolder);

    pages = pages.map((page) => {
      if (page.name === 'error_page' && page.html === undefined) {
        return page;
      }

      // Dump html to file
      const htmlFile = path.join(pagesFolder, `${page.name}.html`);
      log.info(`Writing ${htmlFile}`);
      fs.writeFileSync(htmlFile, page.html);
      return {
        ...page,
        html: `./pages/${page.name}.html`,
      };
    });
  }

  return { pages };
}

const pagesHandler: YAMLHandler<ParsedPages> = {
  parse,
  dump,
};

export default pagesHandler;
