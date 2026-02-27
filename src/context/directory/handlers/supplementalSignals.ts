import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedSupplementalSignals = ParsedAsset<'supplementalSignals', { akamai_enabled?: boolean }>;

function parse(context: DirectoryContext): ParsedSupplementalSignals {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return { supplementalSignals: null }; // Skip

  const supplementalSignalsFile = path.join(baseFolder, 'supplemental-signals.json');

  if (!isFile(supplementalSignalsFile)) {
    return { supplementalSignals: null };
  }

  const supplementalSignals = loadJSON(supplementalSignalsFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  return {
    supplementalSignals,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { supplementalSignals } = context.assets;

  if (!supplementalSignals) return; // Skip, nothing to dump

  const supplementalSignalsFile = path.join(context.filePath, 'supplemental-signals.json');
  dumpJSON(supplementalSignalsFile, supplementalSignals);
}

export default {
  parse,
  dump,
} as DirectoryHandler<ParsedSupplementalSignals>;
