import { YAMLHandler } from '.';
import YAMLContext from '..';
import { maskSecretAtPath } from '../../../tools/utils';
import { Asset, ParsedAsset } from '../../../types';

type ParsedLogStreams = ParsedAsset<'logStreams', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedLogStreams> {
  const { logStreams } = context.assets;

  if (!logStreams) return { logStreams: null };

  return {
    logStreams,
  };
}

async function dump(context: YAMLContext): Promise<ParsedLogStreams> {
  const { logStreams } = context.assets;

  if (!logStreams) return { logStreams: null };

  // masked sensitive fields
  const sensitiveKeys = [
    'httpAuthorization',
    'splunkToken',
    'datadogApiKey',
    'mixpanelServiceAccountPassword',
    'segmentWriteKey',
  ];

  const maskedLogStreams = logStreams.map((logStream) => {
    if (logStream.sink) {
      sensitiveKeys.forEach((key) => {
        if (logStream.sink && logStream.sink[key]) {
          maskSecretAtPath(logStream.sink as object, key, 'logStreams', logStream.type);
        }
      });
    }
    return logStream;
  });

  return {
    logStreams: maskedLogStreams,
  };
}

const logStreamsHandler: YAMLHandler<ParsedLogStreams> = {
  parse: parse,
  dump: dump,
};

export default logStreamsHandler;
