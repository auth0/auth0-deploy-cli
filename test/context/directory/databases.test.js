import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/databases';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';


const usersDB = {
  'database.json': `
    {
      "name": "users","enabled_clients": ["My SPA"],
      "options": {
        "enabledDatabaseCustomization": true,
        "customScripts": {
          "login": "./login.js",
          "create": "./create.js",
          "delete": "databases/users/delete.js",
          "get_user": "databases/users/get_user.js",
          "change_email": "databases/users/change_email.js",
          "change_password": "databases/users/change_password.js",
          "verify": "databases/users/verify.js"
        }
      }
    }
  `,
  'change_email.js': 'function test(email, callback) {var env = @@env@@};',
  'change_password.js': 'function test(email, callback) {var env = @@env@@};',
  'create.js': 'function test(email, callback) {var env = @@env@@};',
  'delete.js': 'function test(email, callback) {var env = @@env@@};',
  'get_user.js': 'function test(email, callback) {var env = @@env@@};',
  'login.js': 'function test(email, callback) {var env = @@env@@};',
  'verify.js': 'function test(email, callback) {var env = @@env@@};'
};

describe('#directory context databases', () => {
  it('should process databases', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'databases1');
    createDir(path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY), { users: usersDB });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal([
      {
        enabled_clients: [
          'My SPA'
        ],
        name: 'users',
        options: {
          customScripts: {
            change_email: 'function test(email, callback) {var env = "test"};',
            change_password: 'function test(email, callback) {var env = "test"};',
            create: 'function test(email, callback) {var env = "test"};',
            delete: 'function test(email, callback) {var env = "test"};',
            get_user: 'function test(email, callback) {var env = "test"};',
            login: 'function test(email, callback) {var env = "test"};',
            verify: 'function test(email, callback) {var env = "test"};'
          },
          enabledDatabaseCustomization: true
        }
      }
    ]);
  });

  it('should ignore missing database.json', async () => {
    const db = { ...usersDB };
    delete db['database.json'];

    const repoDir = path.join(testDataDir, 'directory', 'databases2');
    createDir(path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY), { users: db });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal([]);
  });

  it('should ignore invalid scripts', async () => {
    const db = { ...usersDB };
    db['invalid.js'] = 'function invalid() {};';

    const repoDir = path.join(testDataDir, 'directory', 'databases3');
    createDir(path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY), { users: db });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal([
      {
        enabled_clients: [
          'My SPA'
        ],
        name: 'users',
        options: {
          customScripts: {
            change_email: 'function test(email, callback) {var env = "test"};',
            change_password: 'function test(email, callback) {var env = "test"};',
            create: 'function test(email, callback) {var env = "test"};',
            delete: 'function test(email, callback) {var env = "test"};',
            get_user: 'function test(email, callback) {var env = "test"};',
            login: 'function test(email, callback) {var env = "test"};',
            verify: 'function test(email, callback) {var env = "test"};'
          },
          enabledDatabaseCustomization: true
        }
      }
    ]);
  });

  it('should ignore bad database-connections directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'databases4');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.CONNECTIONS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump databases', async () => {
    const dir = path.join(testDataDir, 'directory', 'databasesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    const scriptValidate = 'function login() { var env1 = "env2"; }';
    context.assets.databases = [
      {
        name: 'users',
        enabled_clients: [],
        options: {
          customScripts: {
            change_email: scriptValidate,
            change_password: scriptValidate,
            create: scriptValidate,
            delete: scriptValidate,
            get_user: scriptValidate,
            login: scriptValidate,
            verify: scriptValidate
          },
          enabledDatabaseCustomization: true
        },
        strategy: 'auth0'
      }
    ];

    await handler.dump(context);
    const scripsFolder = path.join(dir, constants.DATABASE_CONNECTIONS_DIRECTORY, 'users');
    expect(loadJSON(path.join(scripsFolder, 'database.json'))).to.deep.equal({
      name: 'users',
      enabled_clients: [],
      options: {
        customScripts: {
          change_email: './change_email.js',
          change_password: './change_password.js',
          create: './create.js',
          delete: './delete.js',
          get_user: './get_user.js',
          login: './login.js',
          verify: './verify.js'
        },
        enabledDatabaseCustomization: true
      },
      strategy: 'auth0'
    });

    expect(fs.readFileSync(path.join(scripsFolder, 'change_email.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'change_password.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'create.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'delete.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'get_user.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'login.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'verify.js'), 'utf8')).to.deep.equal(scriptValidate);
  });
});
