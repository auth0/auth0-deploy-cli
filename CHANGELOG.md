# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2019-08-14
### Added
- Ability to exclude connections and databases (AUTH0_EXCLUDED_CONNECTIONS & AUTH0_EXCLUDED_DATABASES)
### Fixed
- Excludes for yaml import

## [3.4.0] - 2019-07-15
### Added
- Load email template for passwordless email connection from external html file #124
- Load custom_login_page template for client from external html file #138

## [3.3.2] - 2019-07-11
### Updated
- pin minor version of source-control-tools@~3.4.1

## [3.3.1] - 2019-06-13
### Fixed
- `allowed_clients`, `allowed_logout_urls`, `allowed_origins` and `callbacks` properties of the `client` can no longer be exported as `null`

## [3.3.0] - 2019-04-22
### Added
- Support for roles and permissions export and import

## [3.2.0] - 2019-04-12
### Changed
- Secrets (`rules configs` and databases `options.configuration`) can no longer be exported

## [3.1.3] - 2019-04-03
### Added
- Clearing empty tenant flags on `import`

## [3.1.2] - 2019-03-22
### Added
- Consistent property sorting for yaml dump #108 #61 #82

## [3.1.1] - 2019-03-15
### Fixed
- Exit status code on error #107

## [3.1.0] - 2019-03-14
### Added
- `AUTH0_EXCLUDED_CLIENTS` option has been added to the config. Works similar to `AUTH0_EXCLUDED_RULES` and `AUTH0_EXCLUDED_RESOURCE_SERVERS`. #102

## [3.0.2] - 2019-03-12
### Fixed
- Remove empty `flags` property from tenant settings #104

## [3.0.1] - 2019-03-04
### Fixed
- fix readonly `flags.enable_sso`

## [3.0.0] - 2019-03-04
### Added
Options added to the config:
- `INCLUDED_PROPS` - enables export of properties that are excluded by default (e.g. `client_secret`)
- `EXCLUDED_PROPS` - provides ability to exclude any unwanted properties from exported objects

### Changed
- `--strip` option has been removed from `export` command. Now **IDs will be stripped by default**. `AUTH0_EXPORT_IDENTIFIERS: true` or `--export_ids` can be used to override.

## [2.3.3] - 2019-03-04
### Fixed
- backport readonly `flags.enable_sso`

## [2.3.2] - 2019-03-02
### Changed
- set `enable_sso` and `sandbox_version` as readonly properties
- alias `export = dump` and `import = deploy` for programmatic usage

## [2.3.1] - 2019-02-27
### Changed
- convert non-integer `session_lifetime` to minutes #95
- update `auth0-source-control-extension-tools`
  - Fix email provider export
  - Process empty arrays of databases

## [2.3.0] - 2019-02-21
### Changed
- Empty arrays in the `tenant.yaml` (`clients: []`) will now lead to deleting all relevant records from the tenant. #89
- Update environment variable explanation in READMEs. #90
- Sanitize file and folder names. #92

## [2.2.5] - 2019-02-04
### Changed
- Fix for using the wrong proxy reference. #80

## [2.2.4] - 2019-01-17
### Changed
- Fix various schema validation issues. auth0-extensions/auth0-source-control-extension-tools PRs #52 thru #57

### Added
- Added 'name' prop to pages examples #76

## [2.2.0] - 2018-11-28
### Changed
- Update package dependency which contains security vulnerabilities.
