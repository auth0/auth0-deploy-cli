import { loadFilesByKey } from '../../../utils';


export default function parse(context) {
  // Load the script file for each rule

  const rules = context.assets.rules || [];

  return {
    rules: [
      ...rules.map(rule => loadFilesByKey(rule, context.basePath, [ 'script' ], context.mappings))
    ]
  };
}
