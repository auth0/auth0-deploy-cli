import path from 'path';
import YAMLContext from './yaml';
import DirectoryContext from './directory';

import { isDirectory } from '../utils';

export default function(filePath, mappings, basePath) {
  if (typeof filePath === 'object') {
    return new YAMLContext(filePath, mappings, basePath);
  }

  if (isDirectory(filePath)) {
    return new DirectoryContext(filePath, mappings, basePath);
  }

  const ext = path.extname(filePath, mappings, basePath);
  if (ext === '.yaml' || ext === '.yml') {
    return new YAMLContext(filePath, mappings, basePath);
  }

  throw new Error(`Unable to determine context processor to load for file ${filePath}`);
}
