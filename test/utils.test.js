import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';
import { Auth0 } from 'auth0-source-control-extension-tools';

import { cleanThenMkdir, testDataDir, mockMgmtClient } from './utils';
import {
  isFile,
  isDirectory,
  getFiles,
  loadJSON,
  existsMustBeDir,
  toConfigFn,
  stripIdentifiers,
  sanitize,
  hoursAsInteger
} from '../src/utils';

describe('#utils', function() {
  it('should check if directory exist', () => {
    const dirExist = path.join(testDataDir, 'utils', 'isdir');
    const dirNotExist = path.join(testDataDir, 'utils', 'notexist');
    cleanThenMkdir(dirExist);
    expect(isDirectory(dirExist)).is.equal(true);
    expect(isDirectory(dirNotExist)).is.equal(false);
  });

  it('should check if file exist', () => {
    const dir = path.join(testDataDir, 'utils', 'isfile');
    cleanThenMkdir(dir);

    const fileNotExist = path.join(dir, 'notexist');
    const fileExist = path.join(dir, 'file');
    fs.writeFileSync(fileExist, 'junk');

    expect(isFile(fileExist)).is.equal(true);
    expect(isFile(fileNotExist)).is.equal(false);
  });


  it('should get files', () => {
    const dir = path.join(testDataDir, 'utils', 'getfiles');
    cleanThenMkdir(dir);
    fs.writeFileSync(path.join(dir, 'test1.json'), 'junk');
    fs.writeFileSync(path.join(dir, 'test2.json'), 'junk');
    fs.writeFileSync(path.join(dir, 'test1.html'), 'junk');
    fs.writeFileSync(path.join(dir, 'test2.html'), 'junk');
    fs.writeFileSync(path.join(dir, 'other.file'), 'junk');

    expect(getFiles(dir, [ '.json', '.html' ])).to.deep.equal([
      path.join(dir, 'test1.html'),
      path.join(dir, 'test1.json'),
      path.join(dir, 'test2.html'),
      path.join(dir, 'test2.json')
    ]);
  });

  it('should load json', () => {
    const dir = path.join(testDataDir, 'utils', 'json');
    cleanThenMkdir(dir);
    const file = path.join(dir, 'test1.json');
    fs.writeFileSync(file, '{"test": "123", "env1": @@env1@@, "env2": "##env2##"}');
    expect(loadJSON(file, { env1: 'test1', env2: 'test2' })).to.deep.equal({
      env1: 'test1',
      env2: 'test2',
      test: '123'
    });
  });


  it('exist must be dir', () => {
    const dirExist = path.join(testDataDir, 'utils', 'existmustbedir');
    const dirNotExist = path.join(testDataDir, 'utils', 'notexist');
    cleanThenMkdir(dirExist);
    expect(existsMustBeDir(dirExist)).is.equal(true);
    expect(existsMustBeDir(dirNotExist)).is.equal(false);
  });

  it('should return config fn', () => {
    const config = toConfigFn({ test: 'data' });
    expect(config('test')).to.equal('data');
  });

  it('should sanitized str for path/file', () => {
    expect(sanitize('test/some*/crazy//[path]')).to.equal('test-some--crazy--[path]');
  });

  it('should strip identifiers', () => {
    const assets = {
      clients: [ { name: 'some client', client_id: 'test' } ],
      rulesConfigs: [ { key: 'test', value: 'test' } ]
    };

    const auth0 = new Auth0(mockMgmtClient(), {}, {});

    expect(stripIdentifiers(auth0, assets)).to.deep.equal({
      clients: [
        {
          name: 'some client'
        }
      ],
      rulesConfigs: [
        {
          key: 'test',
          value: 'test'
        }
      ]
    });
  });

  it('should convert value to integer', () => {
    expect(hoursAsInteger('test', 72)).to.deep.equal({
      test: 72
    });

    expect(hoursAsInteger('test', 1.23)).to.deep.equal({
      test_in_minutes: 74
    });
  });
});
