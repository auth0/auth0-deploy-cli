# Auth0 Deploy CLI via Directory Structure

This README will document how to use the Directory Option of the Auth0-deploy-cli tool. Please refer to the [README.md](README.md) for more information on the Auth0 Deploy CLI.

# Organize your repository
The directory option supports exporting and importing the Auth0 tenant configuration into a pre-defined directory structure.

There is more extensive documentation online for how the files are expected to be laid out to work with the source control configuration utilities [here](https://auth0.com/docs/extensions/github-deploy).  

Here is a simple overview:

```
repository => 
  clients
    client1.json
    client2.json
  connections
    conneciton1.json
  database-connections
    connection1
      database.json
      create.js
      delete.js
      get_user.js
      login.js
      verify.js
  emails
    provider.json
    verify_email.json
    verify_email.html
    welcome_emai.json
    welcome_emai.html
  grants
    grant1.json
  pages
    login.html
    login.json
  pages
    login.html
    login.json
    password_reset.html
    password_reset.json
  resource-servers
    resource server 1.json
    some other resource server.json
  rules
    rule1.js
    rule1.json
  rules-configs
    env_param1.json
    some_secret1.json
```

## Example Export
You can export your current tenant configuration. For example the following command will export your tenant configuration.

NOTE: The option --strip is used to remove the identifier fields from the Auth0 objects. This means when importing into another Auth0 Tenant new id's are generated otherwise the import will fail as the tool cannot find the existing objects by their id.

`a0deploy -c config.json --strip -f directory -o path/to/export`


## Example Import
Included in this directory is an example structure.

###Instructions

1. Copy config.json.example and fill out details
2. Run deploy
```
a0deploy import -c config.json -i .
```

# Usage

## Config
The config will need the client ID and secret from your newly created client (the client is named `auth0-deploy-cli-extension` if you used the extension).

You can either set env variables or place the values in a config file anywhere on the filesystem.

NOTE: By default the tool will also merge in your current environment variables and override the config.json which have the same top key. You can disable this via the command line with the `--no-env` option.

Here is the example of a config.json:

```json
{
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

## ENV Variables and AUTH0_KEYWORD_REPLACE_MAPPINGS
The mappings are there so that you can use the same configuration file for all of your environments (e.g. dev, uat, staging, and prod) without having to have different versions of the files for each environment.  The mappings allow you to replace certain values in your configuration repo with envrionment specic values.  There are two ways to use the keyword mappings.  You can either wrap the key in `@@key@@` or `##key##`.  If you use the `@` symbols, it will do a JSON.stringify on your value before replacing it.  So if it is a string it will add quotes, if it is an array or object it will add braces.  If you use the `#` symbol instead, till just do a literal replacement.  It will not add quotes or brackets.

NOTE: By default the tool will also merge in your current environment variables and override the AUTH0_KEYWORD_REPLACE_MAPPINGS which have the same top key. You can disable this via the command line with the `--no-env` option.

For example, you could specify a different JWT timeout in your dev environment then prod for testing and a different environment URL:

Client.json:
```
{
  ... 
  "callbacks": [
    "##ENVIRONMENT_URL##/auth/callback"
  ],
  "jwt_configuration": {
    "lifetime_in_seconds": @@JWT_TIMEOUT@@,
    "secret_encoded": true
  }
  ...
}
```

Dev Config.json:
```
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT_URL": "http://dev.fabrikam.com",
    "JWT_TIMEOUT": 120,
    ...
  }
```

Prod Config.json:
```
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT_URL": "http://fabrikam.com",
    "JWT_TIMEOUT": 3600,
    ...
  }
```

## AUTH0_EXCLUDED_RULES
This is a list of rule names that should be ignored by the deploy CLI.  It will not delete, update or create rules that match those names.

## Clients
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

## Resource servers
The name of the file is the name of the resource server that is created or updated.

In the .json file you can put the same json you would put when using the Management API for creating resource servers.  It will only try to keep the fields specified inline with what is configured already.  If a resource server doesn't exist yet, it will create it.

## Database Connections
See Database Connection configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-database-connection-scripts)

## Rules
See Rules configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-rules)

NOTE: There is not currently a way to mark rules as manual yet, that will become part of the configuration file in the future.

## Custom Pages
See Custom Pages configuration [here](https://auth0.com/docs/extensions/github-deploy#deploy-hosted-pages)
