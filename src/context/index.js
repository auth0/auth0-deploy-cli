import path from 'path';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';

export default function(filePath, mappings) {
  if (isDirectory(filePath)) {
    return new DirectoryContext(filePath, mappings);
  }

  const ext = path.extname(filePath, mappings);
  if (ext === '.yaml' || ext === '.yml') {
    return new YAMLContext(filePath, mappings);
  }

  throw new Error(`Unable to determine context processor to load for file ${filePath}`);
}
