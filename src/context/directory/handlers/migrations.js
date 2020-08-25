import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';


function parse(context) {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return {}; // Skip

  const migrationsFile = path.join(baseFolder, 'migrations.json');

  if (isFile(migrationsFile)) {
    /* eslint-disable camelcase */
    const migrations = loadJSON(migrationsFile, context.mappings);

    return { migrations };
  }

  return {};
}


async function dump(context) {
  const { migrations } = context.assets;

  if (!migrations || Object.keys(migrations).length === 0) return; // Skip, nothing to dump

  const migrationsFile = path.join(context.filePath, 'migrations.json');
  dumpJSON(migrationsFile, migrations);
}


export default {
  parse,
  dump
};
