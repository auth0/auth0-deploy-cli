import fs from 'fs-extra';
import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';


function parse(context) {
  const pagesFolder = path.join(context.filePath, constants.PAGES_DIRECTORY);
  if (!existsMustBeDir(pagesFolder)) return { pages: undefined }; // Skip

  const files = getFiles(pagesFolder, [ '.json', '.html' ]);

  const sorted = {};

  files.forEach((file) => {
    const { ext, name } = path.parse(file);
    if (!sorted[name]) sorted[name] = {};
    if (ext === '.json') sorted[name].meta = file;
    if (ext === '.html') sorted[name].html = file;
  });

  const pages = [];
  Object.values(sorted).forEach((data) => {
    if (!data.meta) {
      log.warn(`Skipping pages file ${data.html} as missing the corresponding '.json' file`);
    } else if (!data.html) {
      log.warn(`Skipping pages file ${data.meta} as missing corresponding '.html' file`);
    } else {
      pages.push({
        ...loadJSON(data.meta, context.mappings),
        html: loadFile(data.html, context.mappings)
      });
    }
  });

  return {
    pages
  };
}

async function dump(context) {
  const pages = [ ...context.assets.pages || [] ];

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


export default {
  parse,
  dump
};
