# Configuring the Deploy CLI

Configuring the Deploy’s CLI is essential for establishing Auth0 credentials as well as generally modifying the behavior of the tool to your specific needs. There are two ways the Deploy CLI can be configured:

- Configuration file (`config.json`)
- Environment variables

## Configuration file

A standalone JSON file can be used to configure Deploy CLI. This file will usually reside in the root directory of your project and be called `config.json`.

Example **config.json** file:

```json
{
  "AUTH0_DOMAIN": "<YOUR_TENANT_DOMAIN>",
  "AUTH0_CLIENT_ID": "<YOUR_CLIENT_ID>",
  "AUTH0_ALLOW_DELETE": false
}
```

> ⚠️ **NOTE:** Hard-coding credentials is not recommended, and risks secret leakage should this file ever be committed to a public version control system. Instead, passing credentials as [environment variables](#Environment variables) is considered best practice.

### Environment variables

By default, the Deploy CLI ingests environment variables, providing the ability to pass credentials and other configurations to the tool without needing to publish to the `config.json` file. Environment variables can either be used to augment the `config.json` file or replace it altogether depending on the project needs.

Non-primitive configuration values like `AUTH0_KEYWORD_REPLACE_MAPPINGS` and `AUTH0_EXCLUDED` can also be passed in through environment variables so long as these values are properly serialized JSON.

To **disable** the consumption of environment variables for either the `import` or `export` commands, pass the `--env=false` argument.

#### Examples

```shell
# Deploying configuration for YAML formats without a config.json file
export AUTH0_DOMAIN=<YOUR_AUTH0_DOMAIN>
export AUTH0_CLIENT_ID=<YOUR_CLIENT_ID>
export AUTH0_CLIENT_SECRET=<YOUR_CLIENT_SECRET>

a0deploy import --input_file=local/tenant.yaml

# Disable environment variable ingestion
a0deploy export -c=config.json --format=yaml --output_folder=local --env=false

# Non-primitive configuration values
export AUTH0_EXCLUDED='["actions","organizations"]'
export AUTH0_KEYWORD_REPLACE_MAPPINGS='{"ENVIRONMENT":"dev"}'
a0deploy export -c=config.json --format=yaml --output_folder=local
```

## Available Configuration Properties

### `AUTH0_DOMAIN`

String. The domain of the target Auth0 tenant.

### `AUTH0_CLIENT_ID`

String. The ID of the designated Auth0 application used to make API requests.

### `AUTH0_CLIENT_SECRET`

String. The secret of the designated Auth0 application used to make API requests.

### `AUTH0_ACCESS_TOKEN`

String. Short-lived access token for Management API from designated Auth0 application. Can be used in replacement to client ID and client secret combination.

### `AUTH0_ALLOW_DELETE`

Boolean. When enabled, will allow the tool to delete resources. Default: `false`.

### `AUTH0_EXCLUDED`

Array of strings. Excludes entire resource types from being managed, bi-directionally. See also: [excluding resources from management](excluding-from-management.md). Possible values: `actions`, `attackProtection`, `branding`, `clientGrants`, `clients`, `connections`, `customDomains`, `databases`, `emailProvider`, `emailTemplates`, `guardianFactorProviders`, `guardianFactorTemplates`, `guardianFactors`, `guardianPhoneFactorMessageTypes`, `guardianPhoneFactorSelectedProvider`, `guardianPolicies`, `hooks`, `logStreams`, `migrations`, `organizations`, `pages`, `prompts`, `resourceServers`, `roles`, `rules`, `rulesConfigs`, `tenant`, `triggers`

#### Example

```json
{
  "AUTH0_EXCLUDED": ["organizations", "connections", "hooks"]
}
```

### `AUTH0_KEYWORD_REPLACE_MAPPINGS`

Mapping of specific keywords to facilities dynamic replacement. See also: [keyword replacement](keyword-replacement.md).

#### Example

```json
{
  "ENVIRONMENT": "DEV",
  "ALLOWED_ORIGINS": ["https://dev.test-site.com", "localhost"]
}
```

### `AUTH0_EXPORT_IDENTIFIERS`

Boolean. When enabled, will return identifiers of all resources. May be useful for certain debugging or record-keeping scenarios within a single-tenant context. Default: `false`.

### `EXCLUDED_PROPS`

Provides ability to exclude any unwanted properties from management.

#### Example

```json
{
  "connections": ["options.twilio_token"]
}
```

### `AUTH0_AUDIENCE`

String. Separate value from audience value while retrieving an access token for management API. Useful when default Management API endpoints are not publicly exposed.

### `AUTH0_EXCLUDED_RULES`

Array of strings. Excludes the management of specific rules by ID. **Note:** This configuration may be subject to deprecation in the future. See: [excluding resources from management](excluding-from-management.md).

### `AUTH0_EXCLUDED_CLIENTS`

Array of strings. Excludes the management of specific clients by ID. **Note:** This configuration may be subject to deprecation in the future. See: [excluding resources from management](excluding-from-management.md).

### `AUTH0_EXCLUDED_DATABASES`

Array of strings. Excludes the management of specific databases by ID. **Note:** This configuration may be subject to deprecation in the future. See: [excluding resources from management](excluding-from-management.md).

### `AUTH0_EXCLUDED_CONNECTIONS`

Array of strings. Excludes the management of specific connections by ID. **Note:** This configuration may be subject to deprecation in the future. See: [excluding resources from management](excluding-from-management.md).

### `AUTH0_EXCLUDED_RESOURCE_SERVERS`

Array of strings. Excludes the management of specific resource servers by ID. **Note:** This configuration may be subject to deprecation in the future. See: [excluding resources from management](excluding-from-management.md).

---

[[table of contents]](../README.md#documentation)
