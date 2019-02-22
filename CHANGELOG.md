# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - Unreleased
### Added
- `INCLUDED_PROPS` option has been added to the config. It allows user to export properties which are excluded by default (like `client_secret`).
- `EXCLUDED_PROPS` option has been added to the config. It allows user to exclude any unwanted properties from exported objects.

### Changed
- Empty arrays in the `tenant.yaml` (`clients: []`) will now lead to deleting all relevant records form the tenant.
- `strip` option has been removed from `export` command. Now IDs will be stripped by default. Use `--export_ids` or `-e` to prevent that.

### Fixed
- Email provider export issue

## [2.2.0] - 2018-11-28
### Changed
- Update package dependency which contains security vulnerabilities.
