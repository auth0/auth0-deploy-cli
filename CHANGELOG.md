# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Export tools module

### Fixed
- yargs should not be called when required as a module

## [7.1.0] - 2021-06-23
### Changed
- Actions refactoring and fixes [#356]
- Bump auth0@2.35.1

## [7.0.0] - 2021-06-11
### Added
- MFA-1174 Support Recovery Codes
- Support for organizations
- Prompt link to Auth0 Docs upon insufficient scope

### Changed
- Removed dependency on `auth0-source-control-extension-tools`, the package is not part of `auth0-deploy-cli`
- Removed dependency on `auth-extension-tools`

### Deprecated
- Dropped Node.js 8 support

### Fixed
- Upstream node registry

### Security
- Security fixes from dependencies

## [6.0.0] - 2020-12-28
### Deprecated
- This release has been withdrawn

## [5.5.7] - 2021-05-19
### Added
- Add Support Recovery Codes by bumping auth0-source-control-extension-tools@4.7.2

## [5.5.6] - 2021-04-21
### Fixed
- Fix EXCLUDE_PROPS behaviour for connections and databases.

## [5.5.5] - 2021-03-26
### Fixed
- Broken dependencies on 4.5.x range of source-countrol-extension-tools because of organizations.

## [5.5.4] - 2021-03-12
### Fixed
- Remove limit on permissions in roles

## [5.5.3] - 2021-03-10
### Added
- Add webauthn platform as a supported factor

## [5.5.2] - 2021-03-10
### Fixed
- Fix pagination when computing changes

## [5.5.1] - 2021-03-03
### Fixed
- Fix issues with retrieving more than 50 roles

## [5.5.0] - 2021-01-28
### Added
- Add support for `verify_email_by_code` email template [#309]

## [5.3.2] - 2020-12-17
### Fixed
- Fix keyword mapping in client page templates [ESD-10528] [#291]

## [5.3.1] - 2020-11-16
### Fixed
- Fix report error exporting hooks by bumping auth0-source-control-extension-tools@4.1.12 [#289]
- Add MFA factor webauthn-roaming support by bumping auth0-source-control-extension-tools@4.1.12 [#289]

## [5.3.0] - 2020-11-05
### Changed
- Return database `enabled_clients` in deterministic order [#281]

### Fixed
- Fix the structure of the example policies.json, and correct the guardianPolicies test to use `all-applications` instead of `all-application` [#278]
- Fix pagination for specific API calls by bumping auth0-source-control-extension-tools@4.1.9 [#287]

## [5.2.1] - 2020-09-23
### Fixed
- Issue with client grants deleted when using AUTH0_EXCLUDED_CLIENTS

## [5.2.0] - 2020-09-17
### Fixed
- Always sort custom database scripts alphabetically

## [5.1.6] - 2020-09-15
### Fixed
- Add new line support to JSON files generated in directory dumps
- Move write file method to common util
- Update `auth0-source-control-extension-tools`

## [5.1.5] - 2020-08-13
### Fixed
- The --proxy_url option should work properly now. (Although only on Node >= 10).

## [5.1.4] - 2020-08-12
### Fixed
- Connections disabled when the client is added AUTH0_EXCLUDED_CLIENTS list.

## [5.1.3] - 2020-08-04
### Fixed
- Many entities were not being fetched via the Paging API properly.

## [5.1.3] - 2020-08-04
### Fixed
- Many entities were not being fetched via the Paging API properly.

## [5.1.0] - 2020-07-09
### Added
- Add support for three guardian/MFA-related features:
  - Guardian Policies
  - Guardian Phone factor selected provider
  - Guardian Phone factor message types
- Adds support for Migrations

## [5.0.0] - 2020-06-04
### Added
- Allow excluding default values for emailProvider with `AUTH0_EXCLUDED_DEFAULTS` [#236]

### Changed
- [**Breaking**] Updated dependencies and deprecated support for Node versions earlier than 8 via babel@7 and dot-prop@5 [#242]

### Fixed
- pages: fix error when dumping error_page without html property [#247]

## [4.3.1] - 2020-05-20
### Fixed
- Fixed broken mkdirp package dependency

## [4.3.0] - 2020-05-18
### Removed
- Removed several unused dependencies:
  
  - ajv
  - e6-template-strings
  - node-storage
  - readline
  - xregexp

## [4.2.2] - 2020-05-04
### Added
- Support for phone message hook added.
- Configurable connections directory with `AUTH0_CONNECTIONS_DIRECTORY`.

### Removed
- Remove data from verify email example to prevent copy and paste misuse.

## [4.2.1] - 2020-04-06
### Fixed
- Fixed rules' reorder to avoid order collisions by updating `auth0-source-control-extension-tools`

## [4.2.0] - 2020-03-28
### Fixed
- When importing SAML database connections, support client name in the `options.idpinitiated.client_id` property.
- When exporting SAML database connections, convert client ID to client name.

## [4.1.0] - 2020-03-28
### Fixed
- When exporting a mailgun email provider, a placholder api key will be included in the export..

## [4.0.3] - 2020-03-18
### Fixed
- Programmatic usage will not complain about args. [#215]

## [4.0.2] - 2020-02-28
### Added
- Included Deploy CLI version number in User-Agent header.
- If no command line arguments are passed, the usage statement will be printed.

## [4.0.1] - 2020-02-05
### Changed
- Update `auth0-source-control-extension-tools`

### Fixed
- Fixed import and export errors when roles and hooks are not available

## [4.0.0] - 2020-01-29
### Added
- Add support for Hooks and Hook Secrets
- Update `auth0`, `auth0-extension-tools`, `auth0-source-control-extension-tools`, and `js-yaml`

## [3.6.7] - 2020-01-08
### Fixed
- Fixed a crash when no roles are present in a tenant during an export

## [3.6.5] - 2019-12-19
### Added
- Add readonly flag `remove_stale_idp_attributes`

## [3.6.4] - 2019-12-04
### Changed
- Update `https-proxy-agent` and `js-yaml`

## [3.6.3] - 2019-11-04
### Added
- Add `AUTH0_API_MAX_RETRIES` support

## [3.6.2] - 2019-10-18
### Fixed
- Fix mapping for passwordless email connection template

## [3.6.1] - 2019-09-27
### Removed
- Removed `--verbose` option

## [3.6.0] - 2019-08-26
### Changed
- Update `auth0-extension-tools`

### Fixed
- Clear empty descriptions on roles

## [3.5.0] - 2019-08-14
### Added
- Ability to exclude connections and databases (AUTH0_EXCLUDED_CONNECTIONS & AUTH0_EXCLUDED_DATABASES)

### Fixed
- Excludes for yaml import

## [3.4.0] - 2019-07-15
### Added
- Load email template for passwordless email connection from external html file [#124]
- Load custom_login_page template for client from external html file [#138]

## [3.3.2] - 2019-07-11
### Changed
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
- Consistent property sorting for yaml dump [#108] [#61] [#82]

## [3.1.1] - 2019-03-15
### Fixed
- Exit status code on error [#107]

## [3.1.0] - 2019-03-14
### Added
- `AUTH0_EXCLUDED_CLIENTS` option has been added to the config. Works similar to `AUTH0_EXCLUDED_RULES` and `AUTH0_EXCLUDED_RESOURCE_SERVERS`. [#102]

## [3.0.2] - 2019-03-12
### Fixed
- Remove empty `flags` property from tenant settings [#104]

## [3.0.1] - 2019-03-04
### Fixed
- fix readonly `flags.enable_sso`

## [3.0.0] - 2019-03-04
### Added
- Options added to the config:
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
- convert non-integer `session_lifetime` to minutes [#95]
- update `auth0-source-control-extension-tools`
  - Fix email provider export
  - Process empty arrays of databases

## [2.3.0] - 2019-02-21
### Changed
- Empty arrays in the `tenant.yaml` (`clients: []`) will now lead to deleting all relevant records from the tenant. [#89]
- Update environment variable explanation in READMEs. [#90]
- Sanitize file and folder names. [#92]

## [2.2.5] - 2019-02-04
### Changed
- Fix for using the wrong proxy reference. [#80]

## [2.2.4] - 2019-01-17
### Added
- Added 'name' prop to pages examples [#76]

### Changed
- Fix various schema validation issues. auth0-extensions/auth0-source-control-extension-tools PRs [#52] thru [#57]

## 2.2.0 - 2018-11-28
### Changed
- Update package dependency which contains security vulnerabilities.

[#52]: https://github.com/auth0/auth0-deploy-cli/issues/52
[#57]: https://github.com/auth0/auth0-deploy-cli/issues/57
[#61]: https://github.com/auth0/auth0-deploy-cli/issues/61
[#76]: https://github.com/auth0/auth0-deploy-cli/issues/76
[#80]: https://github.com/auth0/auth0-deploy-cli/issues/80
[#82]: https://github.com/auth0/auth0-deploy-cli/issues/82
[#89]: https://github.com/auth0/auth0-deploy-cli/issues/89
[#90]: https://github.com/auth0/auth0-deploy-cli/issues/90
[#92]: https://github.com/auth0/auth0-deploy-cli/issues/92
[#95]: https://github.com/auth0/auth0-deploy-cli/issues/95
[#102]: https://github.com/auth0/auth0-deploy-cli/issues/102
[#104]: https://github.com/auth0/auth0-deploy-cli/issues/104
[#107]: https://github.com/auth0/auth0-deploy-cli/issues/107
[#108]: https://github.com/auth0/auth0-deploy-cli/issues/108
[#124]: https://github.com/auth0/auth0-deploy-cli/issues/124
[#138]: https://github.com/auth0/auth0-deploy-cli/issues/138
[#215]: https://github.com/auth0/auth0-deploy-cli/issues/215
[#236]: https://github.com/auth0/auth0-deploy-cli/issues/236
[#242]: https://github.com/auth0/auth0-deploy-cli/issues/242
[#247]: https://github.com/auth0/auth0-deploy-cli/issues/247
[#278]: https://github.com/auth0/auth0-deploy-cli/issues/278
[#281]: https://github.com/auth0/auth0-deploy-cli/issues/281
[#287]: https://github.com/auth0/auth0-deploy-cli/issues/287
[#289]: https://github.com/auth0/auth0-deploy-cli/issues/289
[#291]: https://github.com/auth0/auth0-deploy-cli/issues/291
[#309]: https://github.com/auth0/auth0-deploy-cli/issues/309
[#356]: https://github.com/auth0/auth0-deploy-cli/issues/356

[Unreleased]: https://github.com/auth0/auth0-deploy-cli/compare/v7.1.0...HEAD
[7.1.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v6.0.0...v7.0.0
[6.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.7...v6.0.0
[5.5.7]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.6...v5.5.7
[5.5.6]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.5...v5.5.6
[5.5.5]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.4...v5.5.5
[5.5.4]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.3...v5.5.4
[5.5.3]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.2...v5.5.3
[5.5.2]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.1...v5.5.2
[5.5.1]: https://github.com/auth0/auth0-deploy-cli/compare/v5.5.0...v5.5.1
[5.5.0]: https://github.com/auth0/auth0-deploy-cli/compare/v5.3.2...v5.5.0
[5.3.2]: https://github.com/auth0/auth0-deploy-cli/compare/v5.3.1...v5.3.2
[5.3.1]: https://github.com/auth0/auth0-deploy-cli/compare/v5.3.0...v5.3.1
[5.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v5.2.1...v5.3.0
[5.2.1]: https://github.com/auth0/auth0-deploy-cli/compare/v5.2.0...v5.2.1
[5.2.0]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.6...v5.2.0
[5.1.6]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.5...v5.1.6
[5.1.5]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.4...v5.1.5
[5.1.4]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.3...v5.1.4
[5.1.3]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.3...v5.1.3
[5.1.3]: https://github.com/auth0/auth0-deploy-cli/compare/v5.1.0...v5.1.3
[5.1.0]: https://github.com/auth0/auth0-deploy-cli/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v4.3.1...v5.0.0
[4.3.1]: https://github.com/auth0/auth0-deploy-cli/compare/v4.3.0...v4.3.1
[4.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v4.2.2...v4.3.0
[4.2.2]: https://github.com/auth0/auth0-deploy-cli/compare/v4.2.1...v4.2.2
[4.2.1]: https://github.com/auth0/auth0-deploy-cli/compare/v4.2.0...v4.2.1
[4.2.0]: https://github.com/auth0/auth0-deploy-cli/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/auth0/auth0-deploy-cli/compare/v4.0.3...v4.1.0
[4.0.3]: https://github.com/auth0/auth0-deploy-cli/compare/v4.0.2...v4.0.3
[4.0.2]: https://github.com/auth0/auth0-deploy-cli/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/auth0/auth0-deploy-cli/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.7...v4.0.0
[3.6.7]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.5...v3.6.7
[3.6.5]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.4...v3.6.5
[3.6.4]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.3...v3.6.4
[3.6.3]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.2...v3.6.3
[3.6.2]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.1...v3.6.2
[3.6.1]: https://github.com/auth0/auth0-deploy-cli/compare/v3.6.0...v3.6.1
[3.6.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.4.0...v3.5.0
[3.4.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.3.2...v3.4.0
[3.3.2]: https://github.com/auth0/auth0-deploy-cli/compare/v3.3.1...v3.3.2
[3.3.1]: https://github.com/auth0/auth0-deploy-cli/compare/v3.3.0...v3.3.1
[3.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.1.3...v3.2.0
[3.1.3]: https://github.com/auth0/auth0-deploy-cli/compare/v3.1.2...v3.1.3
[3.1.2]: https://github.com/auth0/auth0-deploy-cli/compare/v3.1.1...v3.1.2
[3.1.1]: https://github.com/auth0/auth0-deploy-cli/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/auth0/auth0-deploy-cli/compare/v3.0.2...v3.1.0
[3.0.2]: https://github.com/auth0/auth0-deploy-cli/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/auth0/auth0-deploy-cli/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v2.3.3...v3.0.0
[2.3.3]: https://github.com/auth0/auth0-deploy-cli/compare/v2.3.2...v2.3.3
[2.3.2]: https://github.com/auth0/auth0-deploy-cli/compare/v2.3.1...v2.3.2
[2.3.1]: https://github.com/auth0/auth0-deploy-cli/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v2.2.5...v2.3.0
[2.2.5]: https://github.com/auth0/auth0-deploy-cli/compare/v2.2.4...v2.2.5
[2.2.4]: https://github.com/auth0/auth0-deploy-cli/compare/v2.2.0...v2.2.4
