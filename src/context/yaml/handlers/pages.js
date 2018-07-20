import { loadFilesByKey } from '../../../utils';


export default function parse(context) {
  // Load the HTML file for each page

  const pages = context.assets.pages || [];

  return {
    pages: [
      ...pages.map(page => loadFilesByKey(page, context.basePath, [ 'html' ], context.mappings))
    ]
  };
}
