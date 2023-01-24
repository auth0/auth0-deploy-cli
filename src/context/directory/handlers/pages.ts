import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Page } from '../../../tools/auth0/handlers/pages';

type ParsedPages = ParsedAsset<'pages', Page[]>;

function parse(context: DirectoryContext): ParsedPages {
  const pagesFolder = path.join(context.filePath, constants.PAGES_DIRECTORY);
  if (!existsMustBeDir(pagesFolder)) return { pages: null }; // Skip

  const files: string[] = getFiles(pagesFolder, ['.json', '.html']);

  const sorted: {
    [key: string]: {
      meta?: string;
      html?: string;
    };
  } = files.reduce((acc, file) => {
    const { ext, name } = path.parse(file);
    if (!acc[name]) acc[name] = {};
    if (ext === '.json') acc[name].meta = file;
    if (ext === '.html') acc[name].html = file;
    return acc;
  }, {});

  const pages = Object.keys(sorted).flatMap((key): Page[] => {
    const { meta, html } = sorted[key];
    if (!meta) {
      log.warn(`Skipping pages file ${html} as missing the corresponding '.json' file`);
      return [];
    }
    if (!html && ['error_page', 'login'].includes(key)) {
      //Error pages don't require an HTML template, it is valid to redirect errors to URL
      return {
        ...loadJSON(meta, context.mappings),
        html: '',
      };
    }
    if (!html) {
      log.warn(`Skipping pages file ${meta} as missing corresponding '.html' file`);
      return [];
    }
    return {
      ...loadJSON(meta, context.mappings),
      html: loadFileAndReplaceKeywords(html, context.mappings),
    };
  });

  return {
    pages,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const pages = context.assets.pages;

  if (!pages) return;

  const pagesFolder = path.join(context.filePath, constants.PAGES_DIRECTORY);
  fs.ensureDirSync(pagesFolder);

  pages.forEach((page) => {
    const metadata = { ...page };

    if (page.html !== undefined) {
      const htmlFile = path.join(pagesFolder, `${page.name}.html`);
      log.info(`Writing ${htmlFile}`);
      fs.writeFileSync(htmlFile, page.html);
      metadata.html = `./${page.name}.html`;
    }

    const pageFile = path.join(pagesFolder, `${page.name}.json`);
    dumpJSON(pageFile, metadata);
  });
}

const pagesHandler: DirectoryHandler<ParsedPages> = {
  parse,
  dump,
};

export default pagesHandler;
