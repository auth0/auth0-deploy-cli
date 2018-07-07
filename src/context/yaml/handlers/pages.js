import { loadFilesByKey } from 'src/utils';


export default function parse(context) {
  // Load the HTML file for each page

  return {
    pages: [
      ...context.assets.pages.map(page => loadFilesByKey(page, context.configPath, [ 'html' ], context.mappings))
    ]
  };
}
