import zlib from 'zlib';
import path from 'path';
// Nock Config
import {back as nockBack, BackMode, Definition} from 'nock';

type Recording = Definition & { rawHeaders: string[] }; // Hack to fix issue in Nock types that does not include `rawHeaders` property in `Definition` type

export function decodeBuffer(recordingResponse: Definition['response']) {
  try {
    // Decode the hex buffer that nock made
    const response = Array.isArray(recordingResponse)
      ? recordingResponse.join('')
      : recordingResponse?.toString() || '';
    const decoded = Buffer.from(response, 'hex');
    const unzipped = zlib.gunzipSync(decoded).toString('utf-8');
    return JSON.parse(unzipped);
  } catch (err) {
    throw new Error(`Error decoding nock hex:\n${err}`);
  }
}

export function afterRecord(recordings: Definition[]): Definition[] {
  const filteredRecordings = recordings.filter(function (recording): boolean {
    return recording.path !== '/oauth/token';
  });

  return filteredRecordings.map((recording) => {
    recording.response = decodeBuffer(recording.response as string);
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

export function sanitizeRecording(recording: Definition): Definition {
  const sanitizedRecording = recording;

  //@ts-ignore because the `rawHeaders` property does actually exist
  sanitizedRecording.rawHeaders = [];
  sanitizedRecording.scope = 'https://deploy-cli-dev.eu.auth0.com:443';
  sanitizedRecording.body = sanitizeObject(recording.body, ['client_secret']);
  sanitizedRecording.response = sanitizeObject(recording.response, [
    'access_token',
    'client_secret',
    'cert',
    'pkcs7',
  ]);

  return sanitizedRecording;
}

export const sanitizeObject = (
  obj: object | any[] | string | undefined,
  keysToRedact: string[],
  replaceWith = '[REDACTED]'
) => {
  if (typeof obj === 'string' || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, keysToRedact));
  }

  Object.keys(obj).forEach((key) => {
    if (keysToRedact.includes(key)) {
      obj[key] = replaceWith;
    }

    if (typeof obj[key] === 'object') {
      obj[key] = sanitizeObject(obj[key], keysToRedact);
    }
  });

  return obj;
};

const allowedRecordingModes: BackMode[] = ['lockdown', 'record', 'wild'];
let recordingsMode = process.env['AUTH0_HTTP_RECORDINGS'] as BackMode;

if (!allowedRecordingModes.includes(recordingsMode)) {
  throw new Error(`Invalid recording mode: ${process.env['AUTH0_HTTP_RECORDINGS']}. The only ones allowed are: ${allowedRecordingModes.join(", ")}.`);
}

nockBack.setMode(recordingsMode);
nockBack.fixtures = path.join(__dirname, 'recordings');

export function setupRecording(testName) {
  if (!testName) throw new Error('No test name provided');
  return nockBack(testNameToFilename(testName), {
    afterRecord,
    recorder: { enable_reqheaders_recording: false },
  }).then((ret) => {
    return {
      ...ret,
      recordingDone: ret.nockDone,
    };
  });
}
