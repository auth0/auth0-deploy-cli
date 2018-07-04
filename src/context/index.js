import path from 'path';
import YamlContext from './yaml';
import DirectoryContext from './directory';

import { isFile, isDirectory } from '../utils';

export default function(filePath, mappings) {
  if (isDirectory(filePath)) {
    return new DirectoryContext(filePath, mappings);
  }

  if (isFile(filePath)) {
    const ext = path.extname(filePath, mappings);
    if (ext === '.yaml' || ext === '.yml') {
      return new YamlContext(filePath, mappings);
    }
  }

  throw new Error(`Unable to determine context processor to load for file ${filePath}`);
}
