import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset, Asset } from '../../../types';

type ParsedRiskAssessment = ParsedAsset<'riskAssessment', Asset>;

function parse(context: DirectoryContext): ParsedRiskAssessment {
  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const riskAssessmentsFile = path.join(riskAssessmentsDirectory, 'settings.json');

  if (!existsMustBeDir(riskAssessmentsDirectory)) {
    return { riskAssessment: null };
  }

  if (!isFile(riskAssessmentsFile)) {
    return { riskAssessment: null };
  }

  const riskAssessment = loadJSON(riskAssessmentsFile, {
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

  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const riskAssessmentsFile = path.join(riskAssessmentsDirectory, 'settings.json');

  fs.ensureDirSync(riskAssessmentsDirectory);
  dumpJSON(riskAssessmentsFile, riskAssessment);
}

const riskAssessmentsHandler: DirectoryHandler<ParsedRiskAssessment> = {
  parse,
  dump,
};

export default riskAssessmentsHandler;
