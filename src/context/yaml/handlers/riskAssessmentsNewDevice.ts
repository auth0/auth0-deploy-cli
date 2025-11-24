import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRiskAssessmentsNewDevice = ParsedAsset<'riskAssessmentsNewDevice', Asset>;

async function parse(context: YAMLContext): Promise<ParsedRiskAssessmentsNewDevice> {
  const { riskAssessmentsNewDevice } = context.assets;

  if (!riskAssessmentsNewDevice) return { riskAssessmentsNewDevice: null };

  return {
    riskAssessmentsNewDevice,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRiskAssessmentsNewDevice> {
  const { riskAssessmentsNewDevice } = context.assets;

  if (!riskAssessmentsNewDevice) return { riskAssessmentsNewDevice: null };

  return {
    riskAssessmentsNewDevice,
  };
}

const riskAssessmentsNewDeviceHandler: YAMLHandler<ParsedRiskAssessmentsNewDevice> = {
  parse: parse,
  dump: dump,
};

export default riskAssessmentsNewDeviceHandler;
