# Using as a CLI

The Deploy CLI can be used as a standalone command line utility. Doing so provides a simple way to manage your Auth0 tenant configuration in CI/CD workflows.

## `export` command

Fetching configurations from Auth0 tenant to the local machine.

### `--output_folder`, `-o`

Path. Specifies the target directory for configuration files to be written to.

### `--config_file`, `-c`

Path. Specifies the user-defined configuration file (`config.json`). Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

### `--format`, `-f`

Options: yaml or directory. Determines the file format of the exported resource configuration files. See: [Available Resource Config Formats](available-resource-config-formats).

### `--export_ids`, `-e`

Boolean. When enabled, will export the identifier fields for each resource. Default: `false`.

### `--env`

Boolean. Indicates if the tool should ingest environment variables or not. Default: `true`.

### `--debug`

Boolean. Enables more verbose error logging; useful during troubleshooting. Default: `false`.

### `--proxy_url`, `-p`

A url for proxying requests. Only set this if you are behind a proxy.

### Examples

```shell
# Fetching Auth0 tenant configuration in the YAML format
a0deploy export -c=config.json --format=yaml --output_folder=local

# Fetching Auth0 tenant configuration in directory (JSON) format
a0deploy export -c=config.json --format=directory --output_folder=local

# Fetching Auth0 tenant configurations with IDs of all assets
a0deploy export -c=config.json --format=yaml --output_folder=local --export_ids=true
```

## `import` command

Applying configurations from local machine to Auth0 tenant.

### `--input_file`, `-i`

Path. Specifies the location of the resource configuration files. For YAML formats, this will point to the `tenant.yaml` file, for directory formats, this will point to the resource configuration directory.

### `--config_file`, `-c`

Path. Specifies the user-defined configuration file (config.json). Refer to the list of [all configurable properties](./configuring-the-deploy-cli.md).

### `--env`

Boolean. Indicates if the tool should ingest environment variables or not. Default: `true`.

### `--proxy_url`, `-p`

A url for proxying requests. Only set this if you are behind a proxy.

### `--debug`

Boolean. Enables more verbose error logging; useful during troubleshooting. Default: `false`.

### Examples

```shell
# Deploying configuration for YAML formats
a0deploy import -c=config.json --input_file=local/tenant.yaml

# Deploying configuration for directory format
a0deploy import -c=config.json --input_file=local

# Deploying configuration with environment variables ignored
a0deploy import -c=config.json --input_file=local/tenant.yaml --env=false
```

---

[[table of contents]](../README.md#documentation)
