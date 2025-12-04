import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRiskAssessments = ParsedAsset<'riskAssessments', Asset>;

async function parse(context: YAMLContext): Promise<ParsedRiskAssessments> {
  let { riskAssessments } = context.assets;
  const { riskAssessmentsNewDevice } = context.assets as any;

  if (!riskAssessments) return { riskAssessments: null };

  // Merge riskAssessmentsNewDevice into riskAssessments for backward compatibility
  if (riskAssessmentsNewDevice && riskAssessmentsNewDevice.remember_for) {
    riskAssessments = {
      ...riskAssessments,
      newDevice: {
        remember_for: riskAssessmentsNewDevice.remember_for,
      },
    };
  }

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
