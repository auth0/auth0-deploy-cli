import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Page } from '../../../tools/auth0/handlers/pages';

type ParsedPages = ParsedAsset<'pages', Page[]>;

async function parse(context: YAMLContext): Promise<ParsedPages> {
  // Load the HTML file for each page
  const { pages } = context.assets;

  if (!pages) return { pages: null };

  return {
    pages: [
      ...pages.map((page) => ({
        ...page,
        html: page.html ? context.loadFile(page.html) : '',
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedPages> {
  let pages = context.assets.pages;

  if (!pages) {
    return { pages: null };
  }

  const pagesFolder = path.join(context.basePath, 'pages');
  fs.ensureDirSync(pagesFolder);

  pages = pages.map((page) => {
    if (page.html === undefined) {
      return page;
    }

    const htmlFile = path.join(pagesFolder, `${page.name}.html`);
    log.info(`Writing ${htmlFile}`);
    fs.writeFileSync(htmlFile, page.html);
    return {
      ...page,
      html: `./pages/${page.name}.html`,
    };
  });

  return { pages };
}

const pagesHandler: YAMLHandler<ParsedPages> = {
  parse,
  dump,
};

export default pagesHandler;
