import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRiskAssessments = ParsedAsset<'riskAssessments', Asset>;

async function parse(context: YAMLContext): Promise<ParsedRiskAssessments> {
  const { riskAssessments } = context.assets;

  if (!riskAssessments) return { riskAssessments: null };

  return {
    riskAssessments,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRiskAssessments> {
  const { riskAssessments } = context.assets;

  if (!riskAssessments) return { riskAssessments: null };

  return {
    riskAssessments,
  };
}

const riskAssessmentsHandler: YAMLHandler<ParsedRiskAssessments> = {
  parse: parse,
  dump: dump,
};

export default riskAssessmentsHandler;
