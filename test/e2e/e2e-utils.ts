import zlib from 'zlib';
import _ from 'lodash';
import path from 'path';
import { Definition } from 'nock';

type Recording = Definition & { rawHeaders: string[] }; // Hack to fix issue in Nock types that does not include `rawHeaders` property in `Definition` type

export function decodeBuffer(recordingResponse: Definition['response']) {
  try {
    // Decode the hex buffer that nock made
    const response = Array.isArray(recordingResponse)
      ? recordingResponse.join('')
      : recordingResponse;
    const decoded = Buffer.from(response as string, 'hex');
    const unzipped = zlib.gunzipSync(decoded).toString('utf-8');
    return JSON.parse(unzipped);
  } catch (err) {
    throw new Error(`Error decoding nock hex:\n${err}`);
  }
}

export function afterRecord(recordings: Definition[]): Definition[] {
  return recordings.map((recording) => {
    recording.response = decodeBuffer(recording.response as string);
    //@ts-ignore because we know `rawHeaders` actually exists
    return sanitizeRecording(recording);
  });
}

export function testNameToFilename(testName = ''): string {
  if (testName === '') throw new Error('Test name not defined');
  return `${testName.replaceAll(' ', '-')}.json`;
}

export function testNameToWorkingDirectory(testName = ''): string {
  const directoryName = testName.replaceAll(' ', '-');
  return path.join('./local/recorded', directoryName);
}

export function sanitizeRecording(recording: Recording): Recording {
  const sanitizedRecording = recording;

  sanitizedRecording.rawHeaders = (() => {
    const newHeaders = _.chunk(recording.rawHeaders, 2)
      .filter((pair) => {
        return pair[0] !== 'Content-Encoding'; // Prevents recordings from becoming gzipped
      })
      .flat();
    return newHeaders;
  })();

  return sanitizedRecording;
}
