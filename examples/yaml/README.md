# Auth0 Deploy CLI using YAML

This README will document how to use the YAML Option of the Auth0-deploy-cli tool. Please refer to the main project [README.md](../../README.md) for more information on the Auth0 Deploy CLI.

# Overview
The YAML option supports exporting and importing the Auth0 tenant configuration via a YAML file.

For more information on YAML please refer to [http://yaml.org/](http://yaml.org/)

## Example Export
You can export your current tenant configuration. For example the following command will export your tenant configuration.

`a0deploy export -c config.json -f yaml -o path/to/export`

> NOTE: The config value `AUTH0_EXPORT_IDENTIFIERS: true` (or `--export_ids` option) can be used to export the identifier fields to the Auth0 objects. This means you won't be able to import these objects as the tool cannot find the existing objects by their id.

> NOTE: Some of the settings cannot be exported for example emailProvider credentials, rulesConfigs values and others. After export you may need to update the `tenant.yaml` values if you experience schema errors on import.

## Example Import
Please refer to [tenant.yaml](tenant.yaml) for an example configuration.

### Instructions

1. Copy config.json.example and fill out details
2. Run deploy
```bash
a0deploy import -c config.json -i tenant.yaml
```

# Usage

## Config
The config will need the client ID and secret from your newly created client (the client is named `auth0-deploy-cli-extension` if you used the extension).

You can either set environment variables (ie in your terminal) or place the values in a config file anywhere on the filesystem.

> NOTE: By default the tool will also merge in your current environment variables and override the config.json which have the same top key. You can disable this via the command line with the `--no-env` option.

Here is the example of a config.json:

```json
{
  "AUTH0_DOMAIN": "<your auth0 domain (e.g. fabrikam-dev.auth0.com) >",
  "AUTH0_CLIENT_SECRET": "<your deploy client secret>",
  "AUTH0_CLIENT_ID": "<your deploy client ID>",
  "AUTH0_ALLOW_DELETE": false,
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "YOUR_ARRAY_KEY": [
      "http://localhost:8080",
      "https://somedomain.com"
    ],
    "YOUR_STRING_KEY": "some environment specific string"
  },
  "INCLUDED_PROPS": {
    "clients": [ "client_secret" ]
  },
  "EXCLUDED_PROPS": {
    "connections": [ "options.client_secret" ]
  },
  "AUTH0_EXCLUDED_RULES": [ "auth0-account-link-extension" ],
  "AUTH0_EXCLUDED_CLIENTS": [ "auth0-account-link" ],
  "AUTH0_EXCLUDED_RESOURCE_SERVERS": [ "SSO Dashboard API" ],
  "AUTH0_EXCLUDED_DEFAULTS": ["emailProvider"]
}
```

## Environment Variables and AUTH0_KEYWORD_REPLACE_MAPPINGS
The `auth0-deploy-cli` supports environment variables replacements, also known as mappings. This means you can deploy the same Auth0 Tenant configuration across your environments (i.e. dev, uat, staging, and prod). The tool will automatically inject the right values for each environment (i.e callback urls).

Environment variables can be set on the terminal and within the `config.json`. At run time the variables defined in your terminal and `config.json` will be merged. You can disable this via the command line with the `--no-env` option. The terminal variables will take priority over `config.json`

There are two ways to use the keyword mappings in your Auth0 Tenant configuration files. You can inject values using `@@key@@` or `##key##`.

If you use the `@` symbols, it will do a JSON.stringify on your value before replacing it. So if it is a string it will add quotes, if it is an array or object it will add braces.

If you use the `#` symbol instead, it will do a literal replacement. It will not add quotes or brackets.

For example, you could specify a different JWT timeout in your dev environment then prod for testing and a different environment URL:

Client.json:
```json
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
```json
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT_URL": "http://dev.fabrikam.com",
    "JWT_TIMEOUT": 120,
    ...
  }
```

Prod Config.json:
```json
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT_URL": "http://fabrikam.com",
    "JWT_TIMEOUT": 3600,
    ...
  }
```
