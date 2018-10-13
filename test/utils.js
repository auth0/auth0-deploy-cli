import fs from 'fs';
import rmdirSync from 'rmdir-sync';
import path from 'path';
import mkdirp from 'mkdirp';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../src/logger';

log.transports.console.level = 'debug';

chai.use(chaiAsPromised);

export const localDir = 'local';
export const testDataDir = path.resolve(localDir, 'testData');

export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: {
      getAll: () => []
    }
  };
}

export function cleanThenMkdir(dir) {
  try {
    rmdirSync(dir);
  } catch (err) {
    log.error(err);
  }
  mkdirp.sync(dir);
}

export function writeStringToFile(fileName, contents) {
  const fileFd = fs.openSync(fileName, 'w');
  fs.writeSync(fileFd, contents);
  fs.closeSync(fileFd);
  return fileName;
}


export function createDir(repoDir, target) {
  Object.keys(target).forEach((type) => {
    const configDir = path.resolve(repoDir, type);
    cleanThenMkdir(configDir);
    Object.keys(target[type]).forEach((name) => {
      writeStringToFile(
        path.join(configDir, name + '.json'),
        target[type][name].configFile
      );
      if (target[type][name].metadataFile) {
        writeStringToFile(
          path.join(configDir, name + '.meta.json'),
          target[type][name].metadataFile
        );
      }
    });
  });
}
