# Auth0 Deploy CLI via Directory Structure

This README will document how to use the YAML Option of the Auth0-deploy-cli tool. Please refer to the [README.md](README.md) for more information on the Auth0 Deploy CLI.

# Overview
The YAML option supports exporting and importing the Auth0 tenant configuration via a YAML file.

For more information on YAML please refer to [http://yaml.org/](http://yaml.org/)

## Example Export
You can export your current tenant configuration. For example the following command will export your tenant configuration.

`a0deploy export -c config.json --strip -f yaml -o path/to/export`

> NOTE: The option --strip is used to remove the identifier fields from the Auth0 objects. This means when importing into another Auth0 Tenant new id's are generated otherwise the import will fail as the tool cannot find the existing objects by their id.

> NOTE: Some of the settings cannot be exported for example emailProvider credentials, rulesConfigs values and others. After export you may need to update the `tenant.yaml` values if you experience schema errors on import.

## Example Import
Please refer to [tenant.yml](tenant.yml) for an example configuration.

###Instructions

1. Copy config.json.example and fill out details
2. Run deploy
```
a0deploy import -c config.json -i tenant.yaml
```

# Usage

## Config
The config will need the client ID and secret from your newly created client (the client is named `auth0-deploy-cli-extension` if you used the extension).

You can either set env variables or place the values in a config file anywhere on the filesystem.

> NOTE: By default the tool will also merge in your current environment variables and override the config.json which have the same top key. You can disable this via the command line with the `--no-env` option.

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
    "AUTH0_ALLOW_DELETE": false,
    "YOUR_STRING_KEY": "some environment specific string"
  }
}
```

## ENV Variables and AUTH0_KEYWORD_REPLACE_MAPPINGS
The mappings are there so that you can use the same configuration file for all of your environments (e.g. dev, uat, staging, and prod) without having to have different versions of the files for each environment.  The mappings allow you to replace certain values in your configuration repo with envrionment specic values.  There are two ways to use the keyword mappings.  You can either wrap the key in `@@key@@` or `##key##`.  If you use the `@` symbols, it will do a JSON.stringify on your value before replacing it.  So if it is a string it will add quotes, if it is an array or object it will add braces.  If you use the `#` symbol instead, till just do a literal replacement.  It will not add quotes or brackets.

> NOTE: By default the tool will also merge in your current environment variables and override the AUTH0_KEYWORD_REPLACE_MAPPINGS which have the same top key. You can disable this via the command line with the `--no-env` option.

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
