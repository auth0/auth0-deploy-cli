# Auth0 Deploy CLI

Auth0 supports continuous integration and deployment (CI/CD) of Auth0 Tenants through our [source control extensions](https://auth0.com/docs/extensions#deploy-hosted-pages-rules-and-database-connections-scripts-from-external-repositories) and integration into existing CI/CD pipelines by using this **auth0-deploy-cli** tool.

The `auth0-deploy-cli` tool supports the importing and exporting of Auth0 Tenant configuration data.

Supported Features
- Supported Auth0 Objects
  - Tenant Settings
  - Rules (Including Secrets/Settings)
  - Connections
  - Custom Databases
  - Clients / Applications
  - Resource Servers (API's)
  - Pages
  - Email Templates and Provider 
- Configuration options
  - Defined Directory Structure
  - YAML Configuration
  - Programmatically
- Environment Variable Replacements

# WARNING
This tool can be destructive to your Auth0 tenant. Please ensure you have read the documentation and tested the tool on a development tenant before using in production.

# UPGRADING FROM v1 to v2
The `auth0-deploy-cli` was completly rewritten from version 1 to version 2 which means it is not backwards compatible. Please consider the following when upgrading

- The directory structure and format has changed to allow for additional object types
- The command line parameters have changed to allow for additional options such as export.

## Install

### General Install

```
npm i -g auth0-deploy-cli
```

## Pre-requisites

For this tool to function it must be authorized to the Auth0 Management API. You can do this by creating an application in your Auth0 service that has access to the management API with the following scopes before.

Use the [Auth0 Deploy CLI Extension](https://github.com/auth0-extensions/auth0-deploy-cli-extension/blob/master/README.md) to create the application. At the bottom of the README are instructions for doing this by hand instead.

#### Scopes
  * read:tenant_settings
  * update:tenant_settings
  * create:client_grants
  * read:client_grants
  * update:client_grants
  * delete:client_grants
  * create:clients
  * read:clients
  * update:clients
  * delete:clients
  * read:connections
  * update:connections
  * create:resource_servers
  * read:resource_servers
  * update:resource_servers
  * delete:resource_servers
  * read:rules
  * create:rules
  * update:rules
  * delete:rules
  

# Usage

This tool supports multiple methods to import and export Auth0 configuration objects.

### Option 1 - Predefined Directory Structure

Please refer to [Directory README](examples/directory/README.md) for usage instructions and examples.

### Option 2 - YAML configuration file

Please refer to [YAML README](examples/yaml/README.md) for usage instructions and examples.


### Option 3 - Called Programmatically

The tool can be called programmatically. Please see below for an example.

```
import { deploy, dump } from 'auth0-deploy-cli';

const config = {
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_ALLOW_DELETE: false
};


// Export Tenant Config
deploy({
  output_folder: 'path/to/yaml/or/directory',   // Input file for directory, change to .yaml for YAML
  base_path: basePath,                          // Allow to override basepath, if not take from input_file
  config_file: configFile,                      // Option to a config json
  config: configObj,                            // Option to sent in json as object
  strip,                                        // Strip the identifier field for each object type
  secret                                        // Optionally pass in auth0 client secret seperate from config
})
  .then(() => console.log('yey deploy was successful'))
  .catch(err => console.log(`Oh no, something went wrong. Error: ${err}`));


// Import tenant config
dump({
  input_file: 'path/to/yaml/or/directory',  // Input file for directory, change to .yaml for YAML
  base_path: basePath,                      // Allow to override basepath, if not take from input_file
  config_file: configFile,                  // Option to a config json
  config: configObj,                        // Option to sent in json as object
  env,                                      // Allow env variable mappings from process.env
  secret                                    // Optionally pass in auth0 client secret seperate from config
})
  .then(() => console.log('yey deploy was successful'))
  .catch(err => console.log(`Oh no, something went wrong. Error: ${err}`));


```

## CLI Options

The following options are supported by the cli.

`a0deploy --help`

```
Auth0 Deploy CLI

Commands:
  a0deploy import  Deploy Configuration
  a0deploy export  Export Auth0 Tenant Configuration

Options:
  --help           Show help  [boolean]
  --version        Show version number  [boolean]
  --verbose, -v    Dump extra debug information.  [string] [default: false]
  --proxy_url, -p  A url for proxying requests, only set this if you are behind a proxy.  [string]

Examples:
  a0deploy import -c config.yml -i tenant.yaml                    Deploy Auth0 via YAML
  a0deploy import -c config.yml -i path/to/files                  Deploy Auth0 via Path
  a0deploy -c config.json --strip -f yaml -o path/to/export       Dump Auth0 config to folder in YAML format
  a0deploy -c config.json --strip -f directory -o path/to/export  Dump Auth0 config to folder in directory format

See README (https://github.com/auth0/auth0-deploy-cli) for more in-depth information on configuration and setup.
```

# Recommended Approach/Best Practices
The recommended approach for utilizing this CLI is to incorporate it into your build system.  Create a repository to store your deploy configuration, then create a set of configuration files for each environment.  On your continuous integration server, have a deploy build for each environment.  This deploy build should update a local copy of the deploy configuration repository, then run the CLI to deploy it to that environment.  Read on for more detailed information.

### Auth0 Tenant layout
The recommended approach is to have a different Auth0 tenant/account for each environment.  For example: fabrikam-dev, fabrikam-uat, fabrikam-staging, and fabrikam-prod.

### Your Deploy Configuration Repository
Your configuration repository should contain the files as described in the selected option ([Directory](examples/directory/README.md) or [YAML](examples/yaml/README.md)

You should have a branch for each tenant/account.  This allows you to make changes to dev, but not deploy them until you merge.  With this setup, you can have each environment have a CI task that automatically deploys the changes to its target environment when the branch is updated with the latest.

So your flow would be as follows:
dev changes are tested, then merged to uat, once tested they are merged to staging, once staging is tested they are merged to prod.

You may want to set your prod to only deploy when triggered manually.

### Your CI server configuration
Your CI server should have a different deploy task and config for each environment.  Since each tenant/account will need to have the auth0-deploy-cli-extension installed in it with a different domain, client ID, and secret, this has to happen anyway and will avoid accidentally deploying to the wrong environment.

The deploy task should follow these steps:

 1.  Update the local repo to the latest. (each environment should have its own copy of the repo set to its own branch)
 1.  If there are changes, call a0deploy
 1.  Run a suite of tests to confirm configuration is working
 1.  Optional:  merge to next branch

### Use keyword mappings to handle differences between the environments
You should not have to store differences between environments in the Deploy Configuration Repository.  Use the keyword mappings to allow the repository to be environment agnostic, and instead store the differences in the separate config.json files for each environment that are stored on the CI server.

# Other Helpful Topics

### To test locally

Clone the GitHub repo and install globally
```
git clone git@github.com:auth0/auth0-deploy-cli
cd auth0-deploy-cli
npm install
npm run test
```

## To Create Client by Hand

 1.  log into your dashboard
 1.  click the clients tab
 1.  click the "New Client" button
     1.  Name it something like "Deploy Client"
     1.  Select Non-Interactive as the client type
     1.  Click Create
 1.  If you haven't already enabled API's, you may have to toggle the switch to enable API's
 1.  Use the "Select an API" dropdown to choose: "Auth0 Management API"
 1.  Click the Settings tab
 1.  Copy the client ID, you'll need it for a couple steps down
 1.  Click the "Documentation->Management API" link from the top menu
 1.  Using the left navigation click "Client Grants" then "Create a client grant"
 1.  Click the "create:client_grants" scope to create the token
 1.  In the Body section put the following:
 
         {
           "client_id": "<your client ID copied above>",
           "audience": "https://<your domain: (e.g. fabrikam-dev.auth0.com)>/api/v2/",
           "scope": [
              "read:client_grants",
              "create:client_grants",
              "delete:client_grants",
              "update:client_grants",
              "read:users",
              "update:users",
              "delete:users",
              "create:users",
              "read:clients",
              "update:clients",
              "delete:clients",
              "create:clients",
              "read:client_keys",
              "update:client_keys",
              "delete:client_keys",
              "create:client_keys",
              "read:connections",
              "update:connections",
              "delete:connections",
              "create:connections",
              "read:resource_servers",
              "update:resource_servers",
              "delete:resource_servers",
              "create:resource_servers",
              "read:rules",
              "update:rules",
              "delete:rules",
              "create:rules",
              "read:rules_configs",
              "update:rules_configs",
              "delete:rules_configs",
              "read:email_provider",
              "update:email_provider",
              "delete:email_provider",
              "create:email_provider",
              "read:tenant_settings",
              "update:tenant_settings",
              "read:grants",
              "delete:grants",
              "read:guardian_factors",
              "update:guardian_factors",
              "read:email_templates",
              "create:email_templates",
              "update:email_templates"
           ]
         }

 1.  Click the "Try" button


## Known issues
See https://github.com/auth0/auth0-deploy-cli/issues

## License
MIT
