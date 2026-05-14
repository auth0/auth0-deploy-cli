import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import log from '../logger';
import { Assets } from '../types';

export function loadAssets(inputFile: string): Assets {
  const resolved = path.resolve(inputFile);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    const assets: Assets = {};
    const resourceFiles = fs.readdirSync(resolved);
    for (const file of resourceFiles) {
      if (!file.endsWith('.json') && !file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const resourceName = path.basename(file, path.extname(file));
      const content = fs.readFileSync(path.join(resolved, file), 'utf8');
      try {
        (assets as any)[resourceName] = file.endsWith('.json')
          ? JSON.parse(content)
          : yaml.load(content);
      } catch {
        log.warn(`Could not parse ${file}, skipping.`);
      }
    }
    return assets;
  }

  const content = fs.readFileSync(resolved, 'utf8');
  const parsed = resolved.endsWith('.json') ? JSON.parse(content) : yaml.load(content);
  return parsed as Assets;
}
