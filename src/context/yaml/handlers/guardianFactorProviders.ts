import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedGuardianFactorProviders = {
  guardianFactorProviders: Asset[] | null;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedGuardianFactorProviders> {
  const { guardianFactorProviders } = context.assets;

  if (!guardianFactorProviders) return { guardianFactorProviders: null };

  return {
    guardianFactorProviders,
  };
}

const guardianFactorProvidersHandler: YAMLHandler<ParsedGuardianFactorProviders> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default guardianFactorProvidersHandler;
