#! /usr/bin/env node
'use strict';

var _context = require('./context');

var _context2 = _interopRequireDefault(_context);

var _storage = require('./storage');

var _storage2 = _interopRequireDefault(_storage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Created by mostekcm on 11/2/16.
 */

var program = require('commander');
var tools = require('auth0-source-control-extension-tools');
var fs = require('fs');
var managementApi = require('auth0-extension-tools').managementApi;

/**
 * Simple function for dumping help info
 * @param error An error to print after dumping help
 */
function printHelpAndExit(error) {
    program.outputHelp();
    if (error) {
        process.stderr.write("ERROR: " + error + "\n");
    }
    process.exit(2);
}

/**
 * Validate that the argument is actually a file that we can read.
 * @param fileName The name of the file to check
 * @returns {*}
 */
function checkFileExists(fileName) {
    try {
        fs.accessSync(fileName, fs.F_OK);
        return fileName;
    } catch (e) {
        printHelpAndExit(fileName + ": Must be a valid file\n");
        return false;
    }
}

/* Setup our options */
program.option('-i,--input_file <input file>', 'The updates to deploy.  See JSON Format for more information.', checkFileExists).option('-c,--config_file <config file>', 'The JSON configuration file.  See JSON Format for more information.', checkFileExists).option('-s,--state_file <state file>', 'A file for persisting state between runs.  Default: ./local/state', checkFileExists);

/* Add extra help for JSON */
program.on('--help', function () {
    console.log('  Config JSON:');
    console.log('');
    console.log('   {');
    console.log('        "SLACK_INCOMING_WEBHOOK_URL": "https://hooks.slack.com/services/...",');
    console.log('        "AUTH0_DOMAIN": "YOUR_DOMAIN",');
    console.log('        "AUTH0_CLIENT_SECRET": "YOUR_CLIENT_SECRET",');
    console.log('        "AUTH0_CLIENT_ID": "YOUR_CLIENT_ID"');
    console.log('   }');
    console.log('');
    console.log('  Input JSON:');
    console.log('');
    console.log('   {');
    console.log('        "rules": { ');
    console.log('           "rule1name": {');
    console.log('              "script": true,');
    console.log('              "metadata": true,');
    console.log('              "name": "rule1name",');
    console.log('              "scriptFile":"function (user, context, callback) {\n    console.log(\"hello world!\");\n    callback(null, user, context);\n}\n",');
    console.log('              "metadataFile":"{\n  \"enabled\": true,\n  \"order\": 1\n}\n,');
    console.log('           }');
    console.log('        },');
    console.log('        "pages": { ');
    console.log('        },');
    console.log('        "databases": { ');
    console.log('        },');
    console.log('   }');
});

/* Process arguments */
program.parse(process.argv);

/* Make sure we have the input file and config file specified. */
if (!program.input_file) {
    printHelpAndExit("Must set the input file");
}
if (!program.config_file) {
    printHelpAndExit("Must set the config file");
}

var stateFileName = program.state_file ? program.state_file : "./local/state";

console.log('input_file: %s', JSON.stringify(program.input_file));
console.log('config_file: %s', JSON.stringify(program.config_file));
console.log('state_file: %s', JSON.stringify(program.state_file));

/* Grab data from file */

var context = new _context2.default(program.input_file);

console.log('input_file: %s', JSON.stringify(context));

/* Validate the JSON */

/* Prepare configuration by initializing nconf, then passing that as the provider to the config object */
var nconf = require('nconf');
nconf.file(program.config_file);
var config = require('auth0-extension-tools').config();
config.setProvider(function (key) {
    return nconf.get(key);
});

/* Execute the deploy */

var progress = {
    id: "someid",
    user: "someuser",
    sha: "some sha",
    branch: "some branch",
    repository: "some repo"
};
var client = managementApi.getClient({
    domain: config('AUTH0_DOMAIN'),
    clientId: config('AUTH0_CLIENT_ID'),
    clientSecret: config('AUTH0_CLIENT_SECRET')
}).then(function (auth0) {
    tools.deploy(progress, context, auth0, new _storage2.default(stateFileName), config, {});
}).catch(function (err) {
    console.error("Got this error: " + JSON.stringify(err));
});