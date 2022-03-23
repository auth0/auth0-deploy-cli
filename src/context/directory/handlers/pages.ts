import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import {
  getFiles, existsMustBeDir, dumpJSON, loadJSON
} from '../../../utils';
import { DirectoryHandler, Context } from '.'

type ParsedPages = {
  pages: unknown[] | undefined
}

function parse(context: Context): ParsedPages {
  const pagesFolder = path.join(context.filePath, constants.PAGES_DIRECTORY);
  if (!existsMustBeDir(pagesFolder)) return { pages: undefined }; // Skip

  const files: string[] = getFiles(pagesFolder, ['.json', '.html']);

  const sorted: {
    [key: string]: {
      meta?: string
      html?: string
    }
  } = files.reduce((acc, file) => {
    const { ext, name } = path.parse(file);
    if (!acc[name]) acc[name] = {};
    if (ext === '.json') acc[name].meta = file;
    if (ext === '.html') acc[name].html = file;
    return acc
  }, {});

  const pages = Object.values(sorted).flatMap((data) => {
    if (!data.meta) {
      log.warn(`Skipping pages file ${data.html} as missing the corresponding '.json' file`);
    } else if (!data.html) {
      log.warn(`Skipping pages file ${data.meta} as missing corresponding '.html' file`);
    } else {
      return {
        ...loadJSON(data.meta, context.mappings),
        html: loadFileAndReplaceKeywords(data.html, context.mappings)
      };
    }
  });

  return {
    pages
  };
}

async function dump(context: Context): Promise<void> {
  const pages = [...context.assets.pages || []];

  if (!pages) return; // Skip, nothing to dump

  // Create Pages folder
  const pagesFolder = path.join(context.filePath, constants.PAGES_DIRECTORY);
  fs.ensureDirSync(pagesFolder);

  pages.forEach((page) => {
    var metadata = { ...page };

    if (page.name !== 'error_page' || page.html !== undefined) {
      // Dump template html to file
      const htmlFile = path.join(pagesFolder, `${page.name}.html`);
      log.info(`Writing ${htmlFile}`);
      fs.writeFileSync(htmlFile, page.html);
      metadata.html = `./${page.name}.html`;
    }

    // Dump page metadata
    const pageFile = path.join(pagesFolder, `${page.name}.json`);
    dumpJSON(pageFile, metadata);
  });
}

const pagesHandler: DirectoryHandler<ParsedPages> = {
  parse,
  dump,
}

export default pagesHandler;