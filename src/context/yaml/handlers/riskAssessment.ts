import { YAMLHandler } from '.';
import YAMLContext from '..';
import { RiskAssessmentSettings } from '../../../tools/auth0/handlers/riskAssessment';
import { ParsedAsset } from '../../../types';

type ParsedRiskAssessment = ParsedAsset<'riskAssessment', RiskAssessmentSettings>;

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

const riskAssessmentHandler: YAMLHandler<ParsedRiskAssessment> = {
  parse,
  dump,
};

export default riskAssessmentHandler;
