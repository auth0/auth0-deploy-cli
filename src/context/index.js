import YamlContext from './yaml';
import DirectoryContext from './directory';

import { isFile, isDirectory } from '../utils';

export default function(filePath) {
  if (isDirectory(filePath)) {
    return new DirectoryContext(filePath);
  }

  if (isFile(filePath)) {
    return new YamlContext(filePath);
  }

  throw new Error(`Unable to determine context processor to load for file ${filePath}`);
}
