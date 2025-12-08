import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRiskAssessment = ParsedAsset<'riskAssessment', Asset>;

async function parse(context: YAMLContext): Promise<ParsedRiskAssessment> {
  const { riskAssessment } = context.assets;

  if (!riskAssessment) return { riskAssessment: null };

  return {
    riskAssessment,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRiskAssessment> {
  const { riskAssessment } = context.assets;

  if (!riskAssessment) return { riskAssessment: null };

  return {
    riskAssessment,
  };
}

const riskAssessmentsHandler: YAMLHandler<ParsedRiskAssessment> = {
  parse,
  dump,
};

export default riskAssessmentsHandler;
