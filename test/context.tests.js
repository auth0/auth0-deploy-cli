import Context from '../src/context';

const expect = require('chai').expect;
const logger = require('../src/logger');
const rmdirSync = require('rmdir-sync');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const constants = require('auth0-source-control-extension-tools').constants;

const check = function(done, f) {
  try {
    f();
    done();
  } catch (e) {
    done(e);
  }
};

const cleanThenMkdir = (dir) => {
  try {
    rmdirSync(dir);
  } catch (err) {
    logger.error(err);
  }

  mkdirp.sync(dir);
};

const writeStringToFile = (fileName, contents) => {
  const fileFd = fs.openSync(fileName, 'w');
  fs.writeSync(fileFd, contents);
  fs.closeSync(fileFd);
};

describe('#context', () => {
  const localDir = 'local';
  const testDataDir = path.resolve(localDir, 'testData');

  beforeEach(() => {
    logger.transports.console.level = 'debug';
  });

  describe('#context validation', () => {
    it('should do nothing on empty repo', (done) => {
      /* Create empty directory */
      const dir = path.resolve(testDataDir, 'empty');
      cleanThenMkdir(dir);

      const context = new Context(dir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.rules).to.deep.equal({});
            expect(context.databases).to.deep.equal([]);
            expect(context.pages).to.deep.equal({});
            expect(context.clients).to.deep.equal({});
            expect(context.resourceServers).to.deep.equal({});
          });
        });
    });

    it('should error on bad directory', (done) => {
      const dir = path.resolve(testDataDir, 'doesNotExist');

      const context = new Context(dir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Can\'t process ' + dir + ' because: ENOENT: no such file or directory,' +
              ' lstat \'' + dir + '\'');
          });
        });
    });

    it('should process as file', (done) => {
      const target = {
        databases: [
          {
            name: 'db1',
            scripts: {
              login: {
                name: 'login',
                scriptFile: 'function login() { }'
              }
            }
          }
        ]
      };

      const dir = path.resolve(testDataDir, 'asFile');
      const file = path.resolve(dir, 'asFile.json');
      cleanThenMkdir(dir);
      writeStringToFile(file, JSON.stringify(target));

      const context = new Context(file);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.databases).to.deep.equal(target.databases);
          });
        });
    });

    it('should error on symlink', (done) => {
      const dir = path.resolve(testDataDir, 'badSymlink');
      const file = path.join(dir, 'badSymLink');
      const link = path.join(dir, 'link');
      try {
        fs.unlinkSync(link);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }

      cleanThenMkdir(dir);
      fs.symlinkSync(file, link);

      const context = new Context(link);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Not sure what to do with, ' + link + ', it is not a file or directory...');
          });
        });
    });
  });

  describe('#context connections', () => {
    const createDbDir = (databaseDir, data) => {
      const dbDir = path.resolve(databaseDir, data.name);
      cleanThenMkdir(dbDir);

      Object.keys(data.scripts).forEach(scriptName => writeStringToFile(path.join(dbDir, scriptName + '.js'), data.scripts[scriptName].scriptFile));
    };

    it('should process database connections', (done) => {
      const target = [
        {
          name: 'db1',
          scripts: {
            login: {
              name: 'login',
              scriptFile: 'function login() { var hello = @@hello@@; }'
            },
            create: {
              name: 'create',
              scriptFile: 'function create() { }'
            },
            delete: {
              name: 'delete',
              scriptFile: 'function delete() { }'
            },
            change_email: {
              name: 'change_email',
              scriptFile: 'function change_email() { }'
            },
            get_user: {
              name: 'get_user',
              scriptFile: 'function get_user() { }'
            }
          }
        },
        {
          name: 'db2',
          scripts: {
            login: {
              name: 'login',
              scriptFile: 'function login2() { }'
            },
            create: {
              name: 'create',
              scriptFile: 'function create2() { }'
            }
          }
        }
      ];

      const repoDir = path.join(testDataDir, 'connections1');
      const dbDir = path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY);
      target.forEach(data => createDbDir(dbDir, data));

      const context = new Context(repoDir, { hello: 'goodbye' });
      context.init()
        .then(() => {
          check(done, function() {
            target[0].scripts.login.scriptFile = 'function login() { var hello = "goodbye"; }';
            expect(context.databases).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad filename', (done) => {
      const target = [
        {
          name: 'db1',
          scripts: {
            login: {
              name: 'login',
              scriptFile: 'function login() { }'
            },
            createBad: {
              scriptFile: 'function create() { }'
            }
          }
        }
      ];

      const repoDir = path.join(testDataDir, 'connections2');
      const dbDir = path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY);
      const db2Dir = path.join(dbDir, 'db1');
      target.forEach(data => createDbDir(dbDir, data));
      writeStringToFile(path.join(db2Dir, 'junk.json'), 'junk');
      delete target[0].scripts.createBad;

      const context = new Context(repoDir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.databases).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad connections directory', (done) => {
      const target = [
        {
          name: 'db1',
          scripts: {
            login: {
              name: 'login',
              scriptFile: 'function login() { }'
            }
          }
        }
      ];

      const repoDir = path.join(testDataDir, 'connections2');
      const dbDir = path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY);
      target.forEach(data => createDbDir(dbDir, data));
      writeStringToFile(path.join(dbDir, '.DSStore'), 'junk');

      const context = new Context(repoDir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.databases).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad scripts directory', (done) => {
      const repoDir = path.join(testDataDir, 'connections3');
      cleanThenMkdir(repoDir);
      const dir = path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY);
      writeStringToFile(dir, 'junk');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' database scripts directory because: ENOTDIR:' +
              ' not a directory, scandir' +
              ' \'' + dir + '\'');
          });
        });
    });
  });

  describe('#context pages', () => {
    const createPagesDir = (pagesDir, target) => {
      cleanThenMkdir(pagesDir);
      Object.keys(target).forEach((scriptName) => {
        writeStringToFile(path.resolve(pagesDir, scriptName + '.html'), target[scriptName].htmlFile);
        if (target[scriptName].metadata) writeStringToFile(path.resolve(pagesDir, scriptName + '.json'), target[scriptName].metadataFile);
      });
    };

    it('should process pages', (done) => {
      const target = {
        login: {
          htmlFile: '<html>this is login</html>',
          metadata: false,
          name: 'login'
        },
        guardian_multifactor: {
          htmlFile: '<html>this is guardian</html>',
          metadata: true,
          metadataFile: '{ "enabled": "foo" }',
          name: 'guardian_multifactor'
        },
        password_reset: {
          htmlFile: '<html>this is pwd reset 2: ##val##</html>',
          metadata: true,
          metadataFile: '{ "enabled": false }',
          name: 'password_reset'
        },
        error_page: {
          htmlFile: '<html>this is error page @@jsonVal@@</html>',
          metadata: false,
          name: 'error_page'
        }
      };

      const repoDir = path.join(testDataDir, 'pages1');
      const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
      createPagesDir(dir, target);

      const context = new Context(repoDir);
      context.init({
        mappings: {
          val: 'someval',
          jsonVal: [ 'val1', 'val2' ]
        }
      })
        .then(() => {
          check(done, function() {
            target.password_reset.htmlFile = '<html>this is pwd reset 2: someval</html>';
            target.error_page.htmlFile = '<html>this is error page ["val1","val2"]</html>';
            expect(context.pages).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad pagename', (done) => {
      const target = {
        login: {
          htmlFile: '<html>this is login</html>',
          metadata: false,
          name: 'login'
        },
        guardian_multifactor2: {
          htmlFile: '<html>this is guardian</html>',
          metadata: true,
          metadataFile: '{ "enabled": "foo" }'
        }
      };

      const repoDir = path.join(testDataDir, 'pages2');
      const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
      createPagesDir(dir, target);
      delete target.guardian_multifactor2;

      const context = new Context(repoDir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.pages).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad pages directory', (done) => {
      const repoDir = path.join(testDataDir, 'pages3');
      cleanThenMkdir(repoDir);
      const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
      writeStringToFile(dir, 'junk');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' pages directory because: ENOTDIR:' +
              ' not a directory, scandir \'' + dir + '\'');
          });
        });
    });
  });

  describe('#context configurables', () => {
    const createConfigurablesDir = (repoDir, target) => {
      Object.keys(target).forEach((type) => {
        const configDir = path.resolve(repoDir, type);
        cleanThenMkdir(configDir);
        Object.keys(target[type]).forEach((name) => {
          writeStringToFile(path.join(configDir, name + '.json'), target[type][name].configFile);
          if (target[type][name].metadataFile) writeStringToFile(path.join(configDir, name + '.meta.json'), target[type][name].metadataFile);
        });
      });
    };

    it('should process clients and resource servers', (done) => {
      const target = {
        clients: {
          someClient: {
            configFile: '{ "someKey": "someVal" }',
            name: 'someClient'
          },
          someClient2: {
            configFile: '{ "someKey": @@somekey@@ }',
            metadataFile: '{ "someMetaKey": "someMetaVal" }',
            name: 'someClient2'
          }
        },
        'resource-servers': {
          resourceName: {
            configFile: '{ "some1Key": "some1Val" }',
            metadataFile: '{ "some1MetaKey": "som1eMetaVal" }',
            name: 'resourceName'
          }
        }
      };

      const repoDir = path.join(testDataDir, 'configurables1');
      createConfigurablesDir(repoDir, target);

      const context = new Context(repoDir, { somekey: 'someVal' });
      context.init()
        .then(() => {
          check(done, function() {
            target.clients.someClient2.configFile = '{ "someKey": "someVal" }';
            expect(context.clients).to.deep.equal(target.clients);
            expect(context.resourceServers).to.deep.equal(target['resource-servers']);
          });
        });
    });

    it('should ignore bad config file', (done) => {
      const target = {
        clients: {
          someClient: {
            configFile: '{ "someKey": "someVal" }',
            name: 'someClient'
          }
        }
      };

      const repoDir = path.join(testDataDir, 'configurables2');
      createConfigurablesDir(repoDir, target);

      const dir = path.join(repoDir, constants.CLIENTS_DIRECTORY);
      const file = path.join(dir, 'README.md');
      writeStringToFile(file, 'something');

      const context = new Context(repoDir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.clients).to.deep.equal(target.clients);
          });
        });
    });

    it('should ignore bad configurables directory', (done) => {
      const repoDir = path.join(testDataDir, 'configurables3');
      cleanThenMkdir(repoDir);
      const dir = path.join(repoDir, constants.CLIENTS_DIRECTORY);
      writeStringToFile(dir, 'junk');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' client directory because: ENOTDIR:' +
              ' not a directory, scandir \'' + dir + '\'');
          });
        });
    });
  });

  describe('#context rules', () => {
    const createRulesDir = (dir, target) => {
      cleanThenMkdir(dir);
      Object.keys(target).forEach((scriptName) => {
        writeStringToFile(path.resolve(dir, scriptName + '.js'), target[scriptName].scriptFile);
        if (target[scriptName].metadata) writeStringToFile(path.resolve(dir, scriptName + '.json'), target[scriptName].metadataFile);
      });
    };

    const createRuleConfigsDir = (dir, target) => {
      cleanThenMkdir(dir);
      const content = typeof target === 'string' ? target : JSON.stringify(target);
      writeStringToFile(path.resolve(dir, 'config.json'), content);
    };

    const createRulesDirWithTrivialRule = (dir) => {
      const target = {
        someRule: {
          script: true,
          scriptFile: 'function someRule(user, context, callback) { callback(null, user, context); }',
          metadata: false,
          name: 'someRule'
        }
      };
      createRulesDir(dir, target);
    };

    it('should process rules', (done) => {
      const target = {
        someRule: {
          script: true,
          scriptFile: 'function someRule() { var hello = @@hello@@; }',
          metadata: false,
          name: 'someRule'
        },
        someRuleWithMeta: {
          script: true,
          scriptFile: 'function someRuleWithMeta() { }',
          metadata: true,
          metadataFile: '{ "enabled": "foo" }',
          name: 'someRuleWithMeta'
        }
      };

      const repoDir = path.join(testDataDir, 'rules1');
      const dir = path.join(repoDir, constants.RULES_DIRECTORY);
      createRulesDir(dir, target);

      const context = new Context(repoDir, { hello: 'goodbye' });
      context.init()
        .then(() => {
          check(done, function() {
            target.someRule.scriptFile = 'function someRule() { var hello = "goodbye"; }';
            expect(context.rules).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad rules file', (done) => {
      const target = {
        someRule: {
          script: true,
          scriptFile: 'function someRule() { }',
          metadata: false,
          name: 'someRule'
        }
      };

      const repoDir = path.join(testDataDir, 'rules2');
      const dir = path.join(repoDir, constants.RULES_DIRECTORY);
      createRulesDir(dir, target);

      const file = path.join(dir, 'README.md');
      writeStringToFile(file, 'something');

      const context = new Context(repoDir);
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.rules).to.deep.equal(target);
          });
        });
    });

    it('should ignore bad rules directory', (done) => {
      const repoDir = path.join(testDataDir, 'rules3');
      cleanThenMkdir(repoDir);
      const dir = path.join(repoDir, constants.RULES_DIRECTORY);
      writeStringToFile(dir, 'junk');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' the rules directory because: ENOTDIR:' +
              ' not a directory, scandir \'' + dir + '\'');
          });
        });
    });

    it('should process rule configs', (done) => {
      const configOnDisk = {
        CUSTOM_RULES_CONFIG_KEY: 'CUSTOM_RULES_CONFIG_VALUE',
        ANOTHER_CONFIG_KEY: 'ANOTHER_CONFIG_VALUE'
      };

      const expectedConfigPassedOn = {
        CUSTOM_RULES_CONFIG_KEY: {
          name: 'CUSTOM_RULES_CONFIG_KEY',
          configFile: JSON.stringify({ value: 'CUSTOM_RULES_CONFIG_VALUE' })
        },
        ANOTHER_CONFIG_KEY: {
          name: 'ANOTHER_CONFIG_KEY',
          configFile: JSON.stringify({ value: 'ANOTHER_CONFIG_VALUE' })
        }
      };

      const repoDir = path.join(testDataDir, 'ruleConfigs1');
      const dir = path.join(repoDir, constants.RULES_CONFIGS_DIRECTORY);
      createRuleConfigsDir(dir, configOnDisk);
      createRulesDirWithTrivialRule(path.join(repoDir, constants.RULES_DIRECTORY));

      const context = new Context(repoDir, {});
      context.init()
        .then(() => {
          check(done, function() {
            expect(context.ruleConfigs).to.deep.equal(expectedConfigPassedOn);
          });
        });
    });

    it('should ignore bad rules configs directory', (done) => {
      const repoDir = path.join(testDataDir, 'ruleConfigs2');
      cleanThenMkdir(repoDir);
      const dir = path.join(repoDir, constants.RULES_CONFIGS_DIRECTORY);
      writeStringToFile(dir, 'junk');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' the rules configs directory because: ENOTDIR:' +
              ' not a directory, scandir \'' + dir + '\'');
          });
        });
    });

    it('should ignore a rules config file with the wrong structure', (done) => {
      const repoDir = path.join(testDataDir, 'ruleConfigs3');
      const dir = path.join(repoDir, constants.RULES_CONFIGS_DIRECTORY);
      createRuleConfigsDir(dir, [ 'arrays are not okay' ]);

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' the rules configs file because: Invalid format for config.json');
          });
        });
    });

    it('should ignore a non-JSON config file', (done) => {
      const repoDir = path.join(testDataDir, 'ruleConfigs3');
      const dir = path.join(repoDir, constants.RULES_CONFIGS_DIRECTORY);
      createRuleConfigsDir(dir, 'non-JSON files are not okay');

      const context = new Context(repoDir);
      context.init()
        .catch((err) => {
          check(done, function() {
            expect(err.message).to.equal('Couldn\'t process' +
              ' the rules configs file because: config.json is not a JSON document:' +
              ' Unexpected token o in JSON at position 1');
          });
        });
    });
  });
});
