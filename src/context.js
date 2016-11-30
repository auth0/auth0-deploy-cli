import Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';
import {constants, unifyDatabases, unifyScripts} from 'auth0-source-control-extension-tools';


Promise.promisifyAll(fs);

const isPage = (file) => {
    var directory = path.basename(path.dirname(file));
    var nameIndex = constants.PAGE_NAMES.indexOf(file.split('/').pop());
    logger.debug("directory: " + directory + ", nameIndex: " + nameIndex);
    return directory === constants.PAGES_DIRECTORY && nameIndex >= 0;
}

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
    const files = [];

    try {
        fs.accessSync(dirPath, fs.F_OK);
        // file  exists, also make sure it is a directory
        if (fs.lstatSync(dirPath).isDirectory()) {
            logger.debug("Looking for rules in " + dirPath);
            /* Grab the files and loop through them */
            files.push(fs.readdirAsync(dirPath).then((files) => {
                files.forEach(fileName => {
                    /* Process File */
                    const ruleName = path.parse(fileName).name;
                    const ext = path.parse(fileName).ext;
                    rules[ruleName] = rules[ruleName] || {};

                    if (ext === '.js') {
                        rules[ruleName].script = true;
                        rules[ruleName].scriptFileName = path.join(dirPath, fileName);
                    } else if (ext === '.json') {
                        rules[ruleName].metadata = true;
                        rules[ruleName].metadataFileName = path.join(dirPath, fileName);
                    }
                })
            })
                .catch(function (e) {
                    logger.error("Couldn't process " + dirPath + " because: ");
                    logger.error(e);
                }));
        }
    } catch (e) {
        /* Rules must not exist.
         * TODO should probably check for NOENT here instead of just failing silently
         */
        logger.debug(dirPath + " does not exist, no rules found!");
        logger.debug(e);
    }

    // Download all rules.
    return Promise.all(files).then(() => Promise.map(Object.keys(rules), (ruleName) =>
        processRule(ruleName, rules[ruleName]), {concurrency: 2}));
};

/*
 * Process a single database script.
 */
const processClientConfig = (clientName, clientFiles) => {
    const client = {
        name: clientName,
    };

    const attributeNames = [ { name: 'scriptFileName', content: 'scriptFile' }, { name: 'metaFileName', content: 'metaFile' } ];

    const filePromises = [];
    attributeNames.forEach(function(names) {
        if (names.name in clientFiles) {
            filePromises.push(fs.readFileAsync(clientFiles[names.name], 'utf8').then(
                (contents) => {
                    client[names.content] = contents;
                }));
        }
    });

    return Promise.all(filePromises)
        .then(() => client);
};

/*
 * Get all database scripts.
 */
const getClientConfigs = (dirPath) => {
    const clients = {};

    // Determine if we have the script, the metadata or both.
    return fs.readdirAsync(dirPath).then((files) => {
        files.forEach(function (fileName) {
            logger.debug("Found client file: " + fileName);
            /* check for meta/config pairs */
            const fullFileName = path.join(dirPath, fileName);
            let clientName = path.parse(fileName).name;
            let meta = false;

            /* check for meta files */
            if (clientName.endsWith('.meta')) {
                clientName = path.parse(clientName).name;
                meta = true;
            }

            /* Initialize object if needed */
            clients[clientName] = clients[clientName] || {};

            if (meta) {
                clients[clientName].metaFileName = fullFileName;
            } else {
                clients[clientName].scriptFileName = fullFileName;
            }
        });
    })
        .then(() => Promise.map(Object.keys(clients),
            (clientName) =>
                processClientConfig(clientName, clients[clientName]),
            {concurrency: 2}));
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
    scripts.forEach(script => {
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
    const parts = filename.split('/');
    while (parts.length > 3) {
        parts.shift();
    }
    logger.debug("Found " + filename + " it has these parts: " + JSON.stringify(parts));
    if (parts.length === 3 &&
        parts[0] === constants.DATABASE_CONNECTIONS_DIRECTORY &&
        /\.js$/i.test(parts[2])) {
        const scriptName = path.parse(parts[2]).name;
        if (constants.DATABASE_SCRIPTS.indexOf(scriptName) > -1) {
            return {
                database: parts[1],
                name: path.parse(scriptName).name
            };
        }
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
            logger.debug("Looking for database-connections in :" + fullDir);
            filePromises.push(
                fs.readdirAsync(fullDir).then((files) => {
                    files.forEach(function (fileName) {
                        const fullFileName = path.join(fullDir, fileName);
                        const script = getDatabaseScriptDetails(fullFileName);
                        if (script) {
                            databases[script.database] = databases[script.database] || [];
                            script.scriptFileName = fullFileName;
                            databases[script.database].push(script);
                        }
                    });
                }));
        });
        return Promise.all(filePromises);
    })
        .then(() => Promise.map(Object.keys(databases), (databaseName) =>
            processDatabaseScript(databaseName, databases[databaseName]),
        {concurrency: 2}));
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
    const files = [];

    try {
        fs.accessSync(dirPath, fs.F_OK);
        // file  exists, also make sure it is a directory
        if (fs.lstatSync(dirPath).isDirectory()) {
            /* Grab the files and loop through them */
            files.push(
                fs.readdirAsync(dirPath).then((files) => {
                    files.forEach(fileName => {
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
                            logger.warn("Skipping file that is not a page: " + fullFileName);
                        }
                    });
                })
                    .catch(function (e) {
                        logger.error("Couldn't process directory," + dirPath + " , because: " + JSON.stringify(e));
                    }));
        } else {
            logger.error("Can't process pages file that is not a directory: " + dirPath);
        }
    } catch (e) {
        /* Pages must not exist.
         * TODO should probably check for NOENT here instead of just failing silently
         */
        logger.debug("Processing pages: " + JSON.stringify(e));
    }

    return Promise.all(files).then(() => Promise.map(Object.keys(pages), (pageName) =>
        processPage(pageName, pages[pageName]), {concurrency: 2}));
};

const getChanges = (filePath) => {
    var fullPath = path.resolve(filePath);
    var lstat = fs.lstatSync(fullPath);
    if (lstat.isDirectory()) {
        /* If this is a directory, look for each file in the directory */
        logger.debug("Processing " + filePath + " as directory " + fullPath);

        var promises = {
            rules: getRules(path.join(fullPath, constants.RULES_DIRECTORY)),
            pages: getPages(path.join(fullPath, constants.PAGES_DIRECTORY)),
            databases: getDatabaseScripts((path.join(fullPath, constants.DATABASE_CONNECTIONS_DIRECTORY))),
            clients: getClientConfigs((path.join(fullPath, constants.CLIENTS_DIRECTORY)))
        };

        return Promise.props(promises)
            .then((result) => ({
                rules: unifyScripts(result.rules),
                databases: unifyDatabases(result.databases),
                pages: unifyScripts(result.pages),
                clients: unifyScripts(result.clients)
            }));
    } else if (lstat.isFile()) {
        /* If it is a file, parse it */
        return JSON.parse(fs.readFileSync(fullPath));
    } else {
        throw new Error("Not sure what to do with, " + fullPath + ", it is not a file or directory...");
    }
}

export default class {
    constructor(fileName) {
        this.fileName = fileName;
    }

    init() {
        var me = this;
        /* First parse the input file */
        return getChanges(me.fileName)
            .then(
                /* Map just the data that is in the config file */
                (data) => {
                    me.pages = data.pages || {};
                    me.rules = data.rules || {};
                    me.databases = data.databases || [];
                    me.clients = data.clients || {};
               });
    }
}