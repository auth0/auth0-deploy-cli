import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';
import { Auth0 } from 'auth0-source-control-extension-tools';

import { cleanThenMkdir, testDataDir, mockMgmtClient } from './utils';
import {
  clearClientArrays,
  dumpJSON,
  existsMustBeDir,
  formatResults,
  getFiles,
  hoursAsInteger,
  isDirectory,
  isFile,
  loadJSON,
  recordsSorter,
  sanitize,
  stripIdentifiers,
  toConfigFn
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
    fs.writeFileSync(
      file,
      '{"test": "123", "env1": @@env1@@, "env2": "##env2##"}'
    );
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

  it('should format object', () => {
    const result = formatResults({
      b: 'Bravo',
      id: 'Id',
      d: 'Delta',
      identifier: 'Identifier',
      c: 'Charlie',
      name: 'Name',
      a: 'Alpha'
    });
    expect(Object.keys(result)).to.deep.equal([
      'name',
      'identifier',
      'id',
      'a',
      'b',
      'c',
      'd'
    ]);
    expect(result).to.deep.equal({
      name: 'Name',
      identifier: 'Identifier',
      id: 'Id',
      a: 'Alpha',
      b: 'Bravo',
      c: 'Charlie',
      d: 'Delta'
    });
  });

  it('should not format result for string', () => {
    const result = formatResults('abc');
    expect(result).to.deep.equal('abc');
  });

  it('should sort records by name or template', () => {
    const name = [
      { name: 'b', id: 0 },
      { name: 'a', id: 1 },
      { name: 'c', id: 2 }
    ];
    const template = [
      { template: 'b', id: 0 },
      { template: 'a', id: 1 },
      { template: 'c', id: 2 }
    ];

    expect(name.sort(recordsSorter)).to.deep.equal([
      { name: 'a', id: 1 },
      { name: 'b', id: 0 },
      { name: 'c', id: 2 }
    ]);
    expect(template.sort(recordsSorter)).to.deep.equal([
      { template: 'a', id: 1 },
      { template: 'b', id: 0 },
      { template: 'c', id: 2 }
    ]);
  });

  it('should clear clients arrays', () => {
    const client = {
      name: 'Default App',
      callbacks: null,
      allowed_clients: null,
      allowed_logout_urls: null,
      is_first_party: true,
      oidc_conformant: false,
      allowed_origins: null
    };

    expect(clearClientArrays(client)).to.deep.equal({
      name: 'Default App',
      callbacks: [],
      allowed_clients: [],
      allowed_logout_urls: [],
      is_first_party: true,
      oidc_conformant: false,
      allowed_origins: []
    });
  });

  it('should not touch correct client arrays', () => {
    const client = {
      name: 'Default App',
      callbacks: [ 'callback' ],
      allowed_clients: [],
      allowed_logout_urls: [ 'url', 'url' ],
      is_first_party: true,
      oidc_conformant: false,
      allowed_origins: [ 'origin' ]
    };

    expect(clearClientArrays(client)).to.deep.equal(client);
  });

  describe('dumpJSON', () => {
    const dir = path.join(testDataDir, 'utils', 'json');
    cleanThenMkdir(dir);
    const file = path.join(dir, 'test1.json');
    const testObject = {
      env1: 'test1',
      env2: 'test2',
      test: '123'
    };
    dumpJSON(file, testObject);
    const testFileContents = fs.readFileSync(file, { encoding: 'utf8' });

    it('should dump JSON with the contents of passed object', () => {
      expect(JSON.parse(testFileContents)).deep.equal(testObject);
    });
    it('should dump json with trailing newline', () => {
      expect(testFileContents).match(/\n$/g);
    });
    it('should throw an error if a path is not writable', () => {
      expect(() => {
        dumpJSON('http://notavalidfilepath', testObject);
      }).throws(/Error writing JSON.*/);
    });
  });
});
