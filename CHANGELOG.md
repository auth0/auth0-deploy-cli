# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - Unreleased
### Added
- `AUTH0_EXCLUDED_CLIENTS` option has been added to the config. Works same as `AUTH0_EXCLUDED_RULES` and `AUTH0_EXCLUDED_RESOURCE_SERVERS`.

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
