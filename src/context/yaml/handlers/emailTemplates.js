import { loadFilesByKey } from '../../../utils';


export default function parse(context) {
  // Load the HTML file for each page

  const emailTemplates = context.assets.emailTemplates || [];
  return {
    emailTemplates: [
      ...emailTemplates.map(et => loadFilesByKey(et, context.basePath, [ 'body' ], context.mappings))
    ]
  };
}
