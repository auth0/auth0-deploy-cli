# Using as a Node Module

The Deploy CLI can not only be used as a standalone CLI, but as a node module. Doing so allows you to manage Auth0 resources within expressive node scripts.

## `dump` function

Fetches configurations from Auth0 tenant to the local machine.

### Example

```ts
import { dump } from 'auth0-deploy-cli';

dump({
  output_folder: './local',
  format: 'yaml',
  config: {
    AUTH0_DOMAIN: '<YOUR_AUTH0_TENANT_DOMAIN>',
    AUTH0_CLIENT_ID: '<YOUR_AUTH0_CLIENT_ID>',
    AUTH0_CLIENT_SECRET: '<YOUR_AUTH0_CLIENT_SECRET>',
  },
})
  .then(() => {
    console.log('Auth0 configuration export successful');
  })
  .catch((err) => {
    console.log('Error during Auth0 configuration export:', err);
  });
```

## Argument parameters

#### `format`

Options: `yaml` or `directory`. Determines the file format of the exported resource configuration files. See: [Available Resource Configuration Formats](available-resource-config-formats).

#### `output_folder`

Path. Specifies the target directory for configuration files to be written to.

#### `config`

Object. Configures behavior of utility. Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

#### `config_file`

Path. Specifies the user-defined configuration file (config.json). Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

#### `export_ids`

Boolean: When enabled, will export the identifier fields for each resource. Default: false.

#### `env`

Boolean. Indicates if the tool should ingest environment variables or not. Default: `false`.

#### `proxy_url`

A url for proxying requests. Only set this if you are behind a proxy.

## `deploy` function

Applies configurations from local machine to Auth0 tenant.

### Argument parameters

#### `input_file`

Path. Specifies the location of the resource configuration files. For YAML formats, this will point to the tenant.yaml file. For directory formats, this will point to the resource configuration directory.

#### `config`

Object. Configures behavior of utility. Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

#### `config_file`

Path. Specifies the user-defined configuration file (config.json). Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

#### `export_ids`

Boolean: When enabled, will export the identifier fields for each resource. Default: `false`.

#### `env`

Boolean. Indicates if the tool should ingest environment variables or not. Default: `false`.

#### `proxy_url`

A url for proxying requests. Only set this if you are behind a proxy.

### Example

```ts
import { deploy } from 'auth0-deploy-cli';

deploy({
  input_file: './local/tenant.yaml',
  config: {
    AUTH0_DOMAIN: '<YOUR_AUTH0_TENANT_DOMAIN>',
    AUTH0_CLIENT_ID: '<YOUR_AUTH0_CLIENT_ID>',
    AUTH0_CLIENT_SECRET: '<YOUR_AUTH0_CLIENT_SECRET>',
  },
})
  .then(() => {
    console.log('Auth0 configuration applied to tenant successful');
  })
  .catch((err) => {
    console.log('Error when applying configuration to Auth0 tenant:', err);
  });
```

---

[[table of contents]](../README.md#documentation)
