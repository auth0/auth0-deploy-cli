import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { SupplementalSignals } from '../../../tools/auth0/handlers/supplementalSignals';

type ParsedSupplementalSignals = ParsedAsset<'supplementalSignals', SupplementalSignals>;

async function parseAndDump(context: YAMLContext): Promise<ParsedSupplementalSignals> {
  const { supplementalSignals } = context.assets;

  if (!supplementalSignals) return { supplementalSignals: null };

  return {
    supplementalSignals,
  };
}

const supplementalSignalsHandler: YAMLHandler<ParsedSupplementalSignals> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default supplementalSignalsHandler;
