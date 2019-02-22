# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - Unreleased
### Added
- `INCLUDED_PROPS` option has been added to the config. It allows user to export properties which are excluded by default (like `client_secret`).
- `EXCLUDED_PROPS` option has been added to the config. It allows user to exclude any unwanted properties from exported objects.

### Changed
- `--strip` option has been removed from `export` command. Now IDs will be stripped by default, but you can use `AUTH0_EXPORT_IDENTIFIERS: true` to prevent.

## [2.3.0] - 2019-02-22
### Changed
- Empty arrays in the `tenant.yaml` (`clients: []`) will now lead to deleting all relevant records from the tenant. #89
- Update environment variable explanation in READMEs. #90
- Sanitize file and folder names. #92

### Fixed
- Email provider export issue

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
