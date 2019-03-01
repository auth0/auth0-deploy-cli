# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.2] - Unreleased
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

## [2.2.5] - 2018-02-04
### Changed
- Fix for using the wrong proxy reference. #80

## [2.2.4] - 2018-01-17
### Changed
- Fix various schema validation issues. auth0-extensions/auth0-source-control-extension-tools PRs #52 thru #57

### Added
- Added 'name' prop to pages examples #76

## [2.2.0] - 2018-11-28
### Changed
- Update package dependency which contains security vulnerabilities.
