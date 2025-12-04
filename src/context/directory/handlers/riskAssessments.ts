import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, loadJSON } from '../../../utils';
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
  const newDeviceFile = path.join(riskAssessmentsDirectory, 'new-device.json');

  if (!existsMustBeDir(riskAssessmentsDirectory)) {
    return { riskAssessments: null };
  }

  const riskAssessments = loadJSON(riskAssessmentsFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  // Load newDevice settings if the file exists (for backward compatibility)
  if (fs.existsSync(newDeviceFile)) {
    const newDeviceSettings = loadJSON(newDeviceFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });
    if (newDeviceSettings && newDeviceSettings.remember_for) {
      riskAssessments.newDevice = {
        remember_for: newDeviceSettings.remember_for,
      };
    }
  }

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
