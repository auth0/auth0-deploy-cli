import { loadFilesByKey } from 'src/utils';


export default function parse(context) {
  // Load the script file for each rule

  return {
    rules: [
      ...context.assets.rules.rules.map(rule => loadFilesByKey(rule, context.configPath, [ 'script' ], context.mappings))
    ]
  };
}
