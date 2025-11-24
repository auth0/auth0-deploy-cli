import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset, Asset } from '../../../types';

type ParsedRiskAssessmentsNewDevice = ParsedAsset<'riskAssessmentsNewDevice', Asset>;

function parse(context: DirectoryContext): ParsedRiskAssessmentsNewDevice {
  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const newDeviceFile = path.join(riskAssessmentsDirectory, 'new-device.json');

  if (!existsMustBeDir(riskAssessmentsDirectory)) {
    return { riskAssessmentsNewDevice: null };
  }

  const riskAssessmentsNewDevice = loadJSON(newDeviceFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  return {
    riskAssessmentsNewDevice,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { riskAssessmentsNewDevice } = context.assets;

  if (!riskAssessmentsNewDevice) return;

  const riskAssessmentsDirectory = path.join(
    context.filePath,
    constants.RISK_ASSESSMENTS_DIRECTORY
  );
  const newDeviceFile = path.join(riskAssessmentsDirectory, 'new-device.json');

  fs.ensureDirSync(riskAssessmentsDirectory);
  dumpJSON(newDeviceFile, riskAssessmentsNewDevice);
}

const riskAssessmentsNewDeviceHandler: DirectoryHandler<ParsedRiskAssessmentsNewDevice> = {
  parse,
  dump,
};

export default riskAssessmentsNewDeviceHandler;
