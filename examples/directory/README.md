# Auth0 Deploy CLI via Directory Structure

This README will document how to use the Directory Option of the Auth0-deploy-cli tool. Please refer to the [../../README.md](README.md) for more information on the Auth0 Deploy CLI.

# Organize your repository
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


# Usage

## Create Your Config File
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

## AUTH0_KEYWORD_REPLACE_MAPPINGS
The mappings are there so that you can use the same configuration file for all of your environments (e.g. dev, uat, staging, and prod) without having to have different versions of the files for each environment.  The mappings allow you to replace certain values in your configuration repo with envrionment specic values.  There are two ways to use the keyword mappings.  You can either wrap the key in `@@key@@` or `##key##`.  If you use the `@` symbols, it will do a JSON.stringify on your value before replacing it.  So if it is a string it will add quotes, if it is an array or object it will add braces.  If you use the `#` symbol instead, till just do a literal replacement.  It will not add quotes or brackets.

For example, you could specify a different JWT timeout in your dev environment then prod for testing and a different environment URL:

Client .json:
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

Dev Config .json:
```
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT_URL": "http://dev.fabrikam.com",
    "JWT_TIMEOUT": 120,
    ...
  }
```

Prod Config .json:
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
