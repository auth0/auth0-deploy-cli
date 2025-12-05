import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset, Asset } from '../../../types';

type ParsedRiskAssessments = ParsedAsset<'riskAssessments', Asset>;

function parse(context: DirectoryContext): ParsedRiskAssessments {
  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const riskAssessmentsFile = path.join(riskAssessmentsDirectory, 'settings.json');

  if (!existsMustBeDir(riskAssessmentsDirectory)) {
    return { riskAssessments: null };
  }

  if (!isFile(riskAssessmentsFile)) {
    return { riskAssessments: null };
  }

  const riskAssessments = loadJSON(riskAssessmentsFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  return {
    riskAssessments,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { riskAssessments } = context.assets;

  if (!riskAssessments) return;

  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const riskAssessmentsFile = path.join(riskAssessmentsDirectory, 'settings.json');

  fs.ensureDirSync(riskAssessmentsDirectory);
  dumpJSON(riskAssessmentsFile, riskAssessments);
}

const riskAssessmentsHandler: DirectoryHandler<ParsedRiskAssessments> = {
  parse,
  dump,
};

export default riskAssessmentsHandler;
