import Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import { constants, unifyDatabases, unifyScripts } from 'auth0-source-control-extension-tools';
import logger from './logger';

Promise.promisifyAll(fs);

const isPage = (file) => {
  var directory = path.basename(path.dirname(file));
  var fileName = path.basename(file);
  var nameIndex = constants.PAGE_NAMES.indexOf(fileName);
  logger.debug('directory: ' + directory + ', nameIndex: ' + nameIndex);
  return directory === constants.PAGES_DIRECTORY && nameIndex >= 0;
};

/*
 * Process a single rule with its metadata.
 */
const processRule = (ruleName, rule) => {
  const currentRule = {
    script: false,
    metadata: false,
    name: ruleName
  };

  const fileProcesses = [];

  if (rule.script) {
    fileProcesses.push(fs.readFileAsync(rule.scriptFileName, 'utf8').then(
      (contents) => {
        currentRule.script = true;
        currentRule.scriptFile = contents;
      }
    ));
  }

  if (rule.metadata) {
    fileProcesses.push(fs.readFileAsync(rule.metadataFileName, 'utf8').then(
      (contents) => {
        currentRule.metadata = true;
        currentRule.metadataFile = contents;
      }));
  }

  return new Promise.all(fileProcesses)
    .then(() => currentRule);
};

/*
 * Determine if we have the script, the metadata or both.
 */
const getRules = (dirPath) => {
  // Rules object.
  const rules = {};

  return fs.readdirAsync(dirPath)
    .then((files) => {
      files.forEach((fileName) => {
        /* Process File */
        const ruleName = path.parse(fileName).name;
        const ext = path.parse(fileName).ext;

        if (ext !== '.js' && ext !== '.json') {
          logger.info('Skipping non-rules file: ' + fileName);
        } else {
          rules[ruleName] = rules[ruleName] || {};

          if (ext === '.js') {
            rules[ruleName].script = true;
            rules[ruleName].scriptFileName = path.join(dirPath, fileName);
          } else if (ext === '.json') {
            rules[ruleName].metadata = true;
            rules[ruleName].metadataFileName = path.join(dirPath, fileName);
          }
        }
      });
    })
    .then(() => Promise.map(Object.keys(rules),
      ruleName => processRule(ruleName, rules[ruleName]), { concurrency: 2 }))
    .catch((e) => {
      if (e.code === 'ENOENT') {
        logger.info('No rules configured');
        return Promise.resolve();
      }

      return Promise.reject(new Error('Couldn\'t process the rules directory because: ' + e.message));
    });
};

/*
 * Process a single database script.
 */
const processConfigurableConfig = (configurableName, configurableFiles) => {
  const configurable = {
    name: configurableName
  };

  const attributeNames = [
    {
      name: 'configFileName',
      content: 'configFile'
    },
    {
      name: 'metadataFileName',
      content: 'metadataFile'
    }
  ];

  const filePromises = [];
  attributeNames.forEach(function(names) {
    if (names.name in configurableFiles) {
      filePromises.push(fs.readFileAsync(configurableFiles[names.name], 'utf8').then(
        (contents) => {
          configurable[names.content] = contents;
        }));
    }
  });

  return Promise.all(filePromises)
    .then(() => configurable);
};

/*
 * Get all configurable items.
 */
const getConfigurableConfigs = (dirPath, type) => {
  const configurables = {};

  // Determine if we have the script, the metadata or both.
  return fs.readdirAsync(dirPath).then((files) => {
    files.forEach(function(fileName) {
      logger.debug('Found ' + type + ' file: ' + fileName);
      /* check for meta/config pairs */
      const fullFileName = path.join(dirPath, fileName);
      const ext = path.parse(fileName).ext;
      if (ext !== '.json') {
        logger.info('Ignoring non-' + type + ' file: ' + fullFileName);
      } else {
        let configurableName = path.parse(fileName).name;
        let meta = false;

        /* check for meta files */
        if (configurableName.endsWith('.meta')) {
          configurableName = path.parse(configurableName).name;
          meta = true;
        }

        /* Initialize object if needed */
        configurables[configurableName] = configurables[configurableName] || {};

        if (meta) {
          configurables[configurableName].metadataFileName = fullFileName;
        } else {
          configurables[configurableName].configFileName = fullFileName;
        }
      }
    });
  })
    .then(() => Promise.map(Object.keys(configurables),
      configurableName =>
        processConfigurableConfig(configurableName, configurables[configurableName]),
      { concurrency: 2 }))
    .catch((e) => {
      if (e.code === 'ENOENT') {
        logger.info('No ' + type + 's configured');
        return Promise.resolve();
      }

      return Promise.reject(new Error('Couldn\'t process ' + type + ' directory because: ' + e.message));
    });
};

/*
 * Process a single database script.
 */
const processDatabaseScript = (databaseName, scripts) => {
  const database = {
    name: databaseName,
    scripts: []
  };

  const files = [];
  scripts.forEach((script) => {
    files.push(fs.readFileAsync(script.scriptFileName, 'utf8').then(
      (contents) => {
        database.scripts.push({
          name: script.name,
          scriptFile: contents
        });
      }));
  });

  return Promise.all(files)
    .then(() => database);
};

/*
 * Get the details of a database file script.
 */
const getDatabaseScriptDetails = (filename) => {
  const baseFileName = path.basename(filename);
  const firstDirname = path.dirname(filename);
  const thisConnectionDir = path.basename(firstDirname);
  const allConnectionsDir = path.basename(path.dirname(firstDirname));
  logger.debug('Found filename: ' + filename + ', base: ' + baseFileName +
               ', thisConn: ' + thisConnectionDir + ', allConn: ' + allConnectionsDir);
  if (allConnectionsDir === constants.DATABASE_CONNECTIONS_DIRECTORY &&
    /\.js$/i.test(baseFileName)) {
    const scriptName = path.parse(baseFileName).name;
    if (constants.DATABASE_SCRIPTS.indexOf(scriptName) > -1) {
      return {
        database: thisConnectionDir,
        name: path.parse(scriptName).name
      };
    }

    logger.warn('Skipping bad database script file: ' + filename + ' because: not a valid DB script: ' + scriptName);
  } else {
    logger.warn('Skipping bad database script file: ' + filename + ' because: bad database dirname: ' + allConnectionsDir + ', or basename: ' + baseFileName);
  }

  return null;
};

/*
 * Get all database scripts.
 */
const getDatabaseScripts = (dirPath) => {
  const databases = {};

  // Determine if we have the script, the metadata or both.
  return fs.readdirAsync(dirPath).then((dirs) => {
    const filePromises = [];
    dirs.forEach((dirName) => {
      var fullDir = path.join(dirPath, dirName);
      logger.info('Looking for database-connections in :' + fullDir);
      filePromises.push(
        fs.readdirAsync(fullDir).then((files) => {
          files.forEach(function(fileName) {
            const fullFileName = path.join(fullDir, fileName);
            const script = getDatabaseScriptDetails(fullFileName);
            if (script) {
              databases[script.database] = databases[script.database] || [];
              script.scriptFileName = fullFileName;
              databases[script.database].push(script);
            }
          });
        })
          .catch(err => logger.warn(`Skipping bad database scripts directory ${fullDir} because: ${err.message}`)));
    });
    return Promise.all(filePromises);
  })
    .then(() => Promise.map(Object.keys(databases),
      databaseName => processDatabaseScript(databaseName, databases[databaseName]),
      { concurrency: 2 }))
    .catch(function(e) {
      if (e.code === 'ENOENT') {
        logger.info('No database scripts configured');
      } else {
        return Promise.reject(new Error('Couldn\'t process database scripts directory because: ' + e.message));
      }

      return Promise.resolve();
    });
};

/*
 * Process a single page script.
 */
const processPage = (pageName, page) => {
  const fileProcesses = [];
  const currentPage = {
    metadata: false,
    name: pageName
  };

  if (page.fileName) {
    fileProcesses.push(fs.readFileAsync(page.fileName, 'utf8').then(
      (contents) => {
        currentPage.htmlFile = contents;
      }));
  }

  if (page.metaFileName) {
    fileProcesses.push(fs.readFileAsync(page.metaFileName, 'utf8').then(
      (contents) => {
        currentPage.metadata = true;
        currentPage.metadataFile = contents;
      }));
  }

  return Promise.all(fileProcesses).then(() => currentPage);
};

/*
 * Get all pages.
 */
const getPages = (dirPath) => {
  const pages = {};

  /* Grab the files and loop through them */
  return fs.readdirAsync(dirPath)
    .then((files) => {
      files.forEach((fileName) => {
        /* Process File */
        const fullFileName = path.join(dirPath, fileName);
        if (isPage(fullFileName)) {
          const pageName = path.parse(fileName).name;
          const ext = path.parse(fileName).ext;
          pages[pageName] = pages[pageName] || {};

          if (ext !== '.json') {
            pages[pageName].fileName = fullFileName;
          } else {
            pages[pageName].metaFileName = fullFileName;
          }
        } else {
          logger.warn('Skipping file that is not a page: ' + fullFileName);
        }
      });
    })
    .then(() => Promise.map(Object.keys(pages),
      pageName => processPage(pageName, pages[pageName]), { concurrency: 2 }))
    .catch(function(e) {
      if (e.code === 'ENOENT') {
        logger.info('No pages configured');
      } else {
        return Promise.reject(new Error('Couldn\'t process pages directory because: ' + e.message));
      }

      return Promise.resolve();
    });
};

const getChanges = (filePath, mappings) => {
  var fullPath = path.resolve(filePath);
  var lstat = null;
  var promises = {};

  try {
    lstat = fs.lstatSync(fullPath);
  } catch (e) {
    return Promise.reject(new Error('Can\'t process ' + fullPath + ' because: ' + e.message));
  }

  if (lstat.isDirectory()) {
    /* If this is a directory, look for each file in the directory */
    logger.info('Processing ' + filePath + ' as directory ' + fullPath);

    promises = {
      rules: getRules(path.join(fullPath, constants.RULES_DIRECTORY)),
      pages: getPages(path.join(fullPath, constants.PAGES_DIRECTORY)),
      databases: getDatabaseScripts((path.join(fullPath, constants.DATABASE_CONNECTIONS_DIRECTORY))),
      clients: getConfigurableConfigs((path.join(fullPath, constants.CLIENTS_DIRECTORY)), 'client'),
      resourceServers: getConfigurableConfigs((path.join(fullPath, constants.RESOURCE_SERVERS_DIRECTORY)), 'resource server')
    };

    return Promise.props(promises)
      .then(result => ({
        rules: unifyScripts(result.rules, mappings),
        databases: unifyDatabases(result.databases, mappings),
        pages: unifyScripts(result.pages, mappings),
        clients: unifyScripts(result.clients, mappings),
        resourceServers: unifyScripts(result.resourceServers, mappings)
      }));
  } else if (lstat.isFile()) {
    /* If it is a file, parse it */
    return Promise.resolve(JSON.parse(fs.readFileSync(fullPath)));
  }

  return Promise.reject(new Error('Not sure what to do with, ' + fullPath + ', it is not a file or directory...'));
};

export default class {
  constructor(fileName, mappings) {
    this.fileName = fileName;
    this.mappings = mappings;
  }

  init(progress) {
    var me = this;
    /* If mappings weren't provided, fall back to the ones provided to init() */
    me.mappings = me.mappings || (progress && progress.mappings);
    /* First parse the input file */
    return getChanges(me.fileName, me.mappings)
      .then(
        /* Map just the data that is in the config file */
        (data) => {
          me.pages = data.pages || {};
          me.rules = data.rules || {};
          me.databases = data.databases || [];
          me.clients = data.clients || {};
          me.resourceServers = data.resourceServers || {};
        });
  }
}
