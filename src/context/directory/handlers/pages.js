import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import { logger } from '../../../logger';
import { groupFiles, existsMustBeDir, loadJSON } from '../../../utils';


function isPage(filePath) {
  return constants.PAGE_NAMES.includes(path.basename(filePath));
}

function parseFileGroup(name, files, mappings) {
  const page = { name };

  files.forEach((file) => {
    if (isPage(file)) {
      const content = loadFile(file, mappings);
      const { ext } = path.parse(file);
      if (ext === '.json') {
        Object.assign(page, loadJSON(file, mappings));
      } else {
        page.html = content;
      }
    } else {
      logger.warn('Skipping file that is not a page: ' + file);
    }
  });

  return page;
}

export default function parse(folder, mappings) {
  const pagesFolder = path.join(folder, constants.PAGES_DIRECTORY);
  existsMustBeDir(pagesFolder);
  const filesGrouped = groupFiles(pagesFolder);

  const pages = Object.entries(filesGrouped)
    .map(([ name, files ]) => parseFileGroup(name, files, mappings))
    .filter(p => Object.keys(p).length > 1); // Filter out invalid pages that have only name key set

  return {
    pages
  };
}
