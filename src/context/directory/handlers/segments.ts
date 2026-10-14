import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedSegments = ParsedAsset<'segments', Asset[]>;

function parse(context: DirectoryContext): ParsedSegments {
  const segmentsDirectory = path.join(context.filePath, constants.SEGMENTS_DIRECTORY);
  if (!existsMustBeDir(segmentsDirectory)) return { segments: null };

  const foundFiles = getFiles(segmentsDirectory, ['.json']);

  const segments = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return {
    segments,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { segments } = context.assets;

  if (!segments) return;

  const segmentsDirectory = path.join(context.filePath, constants.SEGMENTS_DIRECTORY);

  fs.ensureDirSync(segmentsDirectory);

  const expectedFiles = new Set<string>();

  segments.forEach((segment) => {
    const fileName = `${sanitize(segment.name)}.json`;
    const segmentFile = path.join(segmentsDirectory, fileName);
    dumpJSON(segmentFile, segment);
    expectedFiles.add(fileName);
  });

  // Remove files for segments no longer present in the tenant
  for (const existing of fs.readdirSync(segmentsDirectory)) {
    const fullPath = path.join(segmentsDirectory, existing);
    if (fs.statSync(fullPath).isFile() && !expectedFiles.has(existing)) {
      fs.removeSync(fullPath);
    }
  }
}

const segmentsHandler: DirectoryHandler<ParsedSegments> = {
  parse,
  dump,
};

export default segmentsHandler;
