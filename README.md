#Auth0 Deploy CLI

There are a few good extensions that you can use to deploy updates automatically.  This tool utilizes that same code base to allow anyone to pass json to this tool and deploy to your tenant.  This allows you to call this from any tool that can call node.  The intention is to allow deploy from any source code repository and incorporate in any build script.


## Install

### General Install

```
npm i -g auth0-deploy-cli
```

## Usage

### Create a client in your Auth0 Account
You must create a client in your service account that has access to the management API with the following scopes before you can configure the a0deploy CLI.

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
  
#### Client Creation Steps
Use the [Auth0 Deploy CLI Extension](https://github.com/auth0-extensions/auth0-deploy-cli-extension/blob/master/README.md) to Create a client.  At the bottom of the README are instructions for doing this by hand instead.
  
#### Create Your Config File
The config file will need the client ID and secret from your newly created client (the client is named `auth0-deploy-cli-extension` if you used the extension).  You can place this anywhere on the filesystem.  Here is the example:

```json
{
  "SLACK_INCOMING_WEBHOOK_URL": "<your webhook URL from slack, just leave this out if you are not using slack>",
  "AUTH0_DOMAIN": "<your auth0 domain (e.g. fabrikam-dev.auth0.com) >",
  "AUTH0_CLIENT_SECRET": "<your deploy client secret>",
  "AUTH0_CLIENT_ID": "<your deploy client ID>",
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "YOUR_ARRAY_KEY": [
      "http://localhost:8080",
      "https://somedomain.com"
    ],
    "YOUR_STRING_KEY": "some environment specific string"
  },
  "AUTH0_EXCLUDED_RULES": [
    "rule-1-name",
    "rule-2-name"
  ]
}
```

##### AUTH0_KEYWORD_REPLACE_MAPPINGS
The mappings are there so that you can use the same configuration file for all of your environments (e.g. dev, uat, staging, and prod) without having to have different versions of the files for each environment.  The mappings allow you to replace certain values in your configuration repo with envrionment specic values.  For example, you could specify a different JWT timeout in your dev environment then prod for testing:

Client .json:
```
{
  ... 
  "jwt_configuration": {
    "lifetime_in_seconds": @@JWT_TIMEOUT@@,
    "secret_encoded": true
  }
  ...
}
```

Dev Config .json:
```
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "JWT_TIMEOUT": 120,
    ...
  }
```

Prod Config .json:
```
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "JWT_TIMEOUT": 3600,
    ...
  }
```

##### AUTH0_EXCLUDED_RULES
This is a list of rule names that should be ignored by the deploy CLI.  It will not delete, update or create rules that match those names.

#### Organize your repository
There is more extensive documentation online for how the files are expected to be laid out to work with the source control configuration utilities [here](https://auth0.com/docs/extensions/github-deploy).  

If you already have an existing tenant, you can dump your configuration in the right format using the [auth0-dump-config](https://github.com/xurei/auth0-dump-config).

Here is a simple overview:

```
repository => 
  clients
    client1-name.json
    client1-name.meta.json # if specifying client grants
    my-other-client-name.json
  resource-servers
    resource server 1.json
    some other resource server.json
  database-connections
    my-connection-name
      get_user.js
      login.js
  rules
    rule1.js
    rule1.json
    rule2.js
  pages
    login.html
    login.json
    password_reset.html
    password_reset.json
```

##### Clients
The name of the file is the name of the client that is created or updated.

In the .json file you can put the same json you would put when using the Management API for creating clients.  It will only try to keep the fields specified inline with what is configured already.  If a client doesn't exist yet, it will create it.  

To specify client grants, you must specify the following in the metadata file.  (e.g. client1-name.meta.json)

```
{
  "grants": {
    "Resource server audience": [
      "scope1",
      "scope2"
    ]
  }
}
```

##### Resource servers
The name of the file is the name of the resource server that is created or updated.

In the .json file you can put the same json you would put when using the Management API for creating resource servers.  It will only try to keep the fields specified inline with what is configured already.  If a resource server doesn't exist yet, it will create it.

##### Database Connections
See Database Connection configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-database-connection-scripts)

##### Rules
See Rules configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-rules)

NOTE: There is not currently a way to mark rules as manual yet, that will become part of the configuration file in the future.

##### Custom Pages
See Custom Pages configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-pages)

#### Command Line Options

```
a0deploy [ options ]
    -h, --help                      output usage information
    -v,--verbose                    Dump extra debug information.
    -i,--input_file <input file>    The updates to deploy.  See JSON Format for more information.
    -c,--config_file <config file>  The JSON configuration file.  See JSON Format for more information.
    -s,--state_file <state file>    A file for persisting state between runs.  Default: ./local/state    
```

## Recommended Approach/Best Practices
The recommended approach for utilizing this CLI is to incorporate it into your build system.  Create a repository to store your deploy configuration, then create a set of configuration files for each environment.  On your continuous integration server, have a deploy build for each environemnt.  This deploy build should update a local copy of the deploy configuration repository, then run the CLI to deploy it to that environment.  Read on for more detailed information.

### Auth0 Tenant layout
The recommended approach is to have a different Auth0 tenant/account for each environment.  For example: fabrikam-dev, fabrikam-uat, fabrikam-staging, and fabrikam-prod.

### Your Deploy Configuration Repository
Your configuration repository should contain the files as described in the `Organize Your Repository` section above.

You should have a branch for each tenant/account.  This allows you to make changes to dev, but not deploy them until you merge.  With this setup, you can have each environment have a CI task that automatically deploys the changes to its target environment when the branch is updated with the latest.

So your flow would be as follows:
dev changes are tested, then merged to uat, once tested they are merged to staging, once staging is tested they are merged to prod.

You may want to set your prod to only deploy when triggered manually.

### Your CI server configuration
Your CI server should have a different deploy task and config.json for each environment.  Since each tenant/account will need to have the auth0-deploy-cli-extension installed in it with a different domain, client ID, and secret, this has to happen anyway and will avoid accidentally deploying to the wrong environment.

The deploy task should follow these steps:

 1.  Update the local repo to the latest. (each environment should have its own copy of the repo set to its own branch)
 1.  If there are changes, call a0deploy
 1.  Run a suite of tests to confirm configuration is working
 1.  Optional:  merge to next branch

### Use keyword mappings to handle differences between the environments
You should not have to store differences between environments in the Deploy Configuration Repository.  Use the keyword mappings to allow the repository to be environment agnostic, and instead store the differences in the separate config.json files for each environment that are stored on the CI server.

## Other Helpful Topics

### To test locally

Clone the github repo and install globally
```
git clone git@github.com:auth0/auth0-deploy-cli
cd auth0-deploy-cli
npm install
npm run test
```

### To Create Client by Hand

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
             "read:clients",
             "update:clients",
             "delete:clients",
             "create:clients",
             "read:connections",
             "update:connections",
             "read:resource_servers",
             "update:resource_servers",
             "delete:resource_servers",
             "create:resource_servers",
             "read:rules",
             "update:rules",
             "delete:rules",
             "create:rules",
             "read:tenant_settings",
             "update:tenant_settings"
           ]
         }

 1.  Click the "Try" button


##Known issues
See https://github.com/auth0/auth0-deploy-cli/issues

##License
MIT
