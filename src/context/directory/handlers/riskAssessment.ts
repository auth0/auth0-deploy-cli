import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset, Asset } from '../../../types';

type ParsedRiskAssessment = ParsedAsset<'riskAssessment', Asset>;

function parse(context: DirectoryContext): ParsedRiskAssessment {
  const riskAssessmentDirectory = path.join(context.filePath, constants.RISK_ASSESSMENT_DIRECTORY);
  const riskAssessmentFile = path.join(riskAssessmentDirectory, 'settings.json');

  if (!existsMustBeDir(riskAssessmentDirectory)) {
    return { riskAssessment: null };
  }

  if (!isFile(riskAssessmentFile)) {
    return { riskAssessment: null };
  }

  const riskAssessment = loadJSON(riskAssessmentFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  return {
    riskAssessment,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { riskAssessment } = context.assets;

  if (!riskAssessment) return;

  const riskAssessmentDirectory = path.join(context.filePath, constants.RISK_ASSESSMENT_DIRECTORY);
  const riskAssessmentFile = path.join(riskAssessmentDirectory, 'settings.json');

  fs.ensureDirSync(riskAssessmentDirectory);
  dumpJSON(riskAssessmentFile, riskAssessment);
}

const riskAssessmentHandler: DirectoryHandler<ParsedRiskAssessment> = {
  parse,
  dump,
};

export default riskAssessmentHandler;
