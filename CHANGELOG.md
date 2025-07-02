# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [8.10.0] - 2025-07-01

### Added

- Add support new schema fields in `prompt` screens for rendering. [#1124]

### Changed

- Update endpoints for enabled_clients in `connections` and `databases`. [#1123]
- Update CONTRIBUTING.md with detailed setup and workflow instructions. [#1115]

### Fixed

- Fix process execution order for `forms`,`flows`,`flowVaultConnections`. [#1121]
- Fix keyword replacement markers in `databases` enabled_clients. [#1116]

## [8.9.0] - 2025-06-04

### Added

- Add support support limit M2M usage - EA [#1093]
- Add support to fetch list `prompt` screen's settings [#1104]

### Fixed

- Fix secret masking for `connections`, `emailProvider` and `logStreams` [#1103]
- Fix supported resource types in READMEs. [#1109]

## [8.8.3] - 2025-05-27

### Added

- Add support new screens for rendering `prompt` screen's settings [#1096]

### Fixed

- Fix export `databases` options and customScripts [#1095]

## [8.8.2] - 2025-05-08

### Added

- Add support for refresh token policies configuration for `clients` - EA [#1085]

### Changed

- Remove `AUTH0_EXPERIMENTAL_EA` flag check for screens rendering `prompt` screen's settings `import` command [#1084]

### Fixed

- Fix tenant network ACL management not enabled [#1079]
- Fix error handling `guardianFactorProviders`, `guardianFactorTemplates`, `guardianFactors`, `guardianPhoneFactorMessageTypes`, `guardianPhoneFactorSelectedProvider` for forbidden depreated feature [#1086]

## [8.8.1] - 2025-04-28

### Added

- Add support new screens for rendering `prompt` screen's settings [#1071]

### Fixed

- Fix AUTH0_EXCLUDED_CLIENTS support for `clients` YAML format [#1072]

## [8.8.0] - 2025-04-10

### Added

- Add support for tenant ACL EA support [#1063]
- Add support for new prompts in custom-text [#1064]

### Fixed

- Fix remove unsupported ACUL screens for rendering `prompt` screen's settings [#1061]
- Fix update node version requirement to 20(v20.18.1) [#1062]

## [8.7.1] - 2025-03-27

### Added

- Add support new screens for rendering `prompt` screen's settings [#1053]

### Fixed

- Fix get all `customDomains` types [#1054]

### Security

- Security fixes from dependencies [#1054]

## [8.7.0] - 2025-03-13

### Added

- Add support for extensibility as custom phone provider `phoneProviders` [#1038]
- Add support for checkpoint pagination for GET `connections` [#1041]

### Fixed

- Removed survey link from import/export command [#1039]
- Fix dumping JSON files with keyword preserve markers in client grants [#1040]
- Fix warn log insufficient scope for branding templates export [#1047]

### Security

- Security fixes from dependencies [#1046]
- Node 20(v20.18.3) LTS and newer LTS releases are supported [#1046]

## [8.6.2] - 2025-02-21

### Added

- Add support new screens for rendering `prompt` screen's settings [#1035]

## [8.6.1] - 2025-02-20

### Fixed

- Fix docs for support of `forms`,`flows`,`flowVaultConnections` [#1030]
- Fix keyword preservation for `clientGrants` [#1032]
- Fix google credential support for `clients` [#1031]

## [8.6.0] - 2025-02-06

### Added

- Add support new screens for rendering `prompt` screen's settings [#1028]
- Add support for new `--experimental_ea` command flag [#1027]

### Fixed

- Fix keyword for the repository [#1026]

## [8.5.0] - 2025-01-29

### Added

- Add support for reset_email_by_code template for `emailTemplates` [#1014]

### Fixed

- Fix proxy support [#1022]
- Fix schema for phone,email,username as flexible identifiers for `databases` [#1023]
- Fix docs for support of `selfServiceProfiles` [#1021]

## [8.4.4] - 2025-01-20

### Fixed

- Fix `emailProvider` support for Azure and MS365 [#1016]
- Fix npmignore to exclude additional files and directories [#1017]

## [8.4.3] - 2025-01-08

### Fixed

- Fix release CI version bump

## [8.4.2] - 2025-01-08

### Fixed

- Fix Twilio SMS factor provider update for `guardianFactorProviders` [#1007]
- Fix exporting SAML `connections` certificate [#1008]
- Fix `action` code paths for directory format exports [#1009]
- Fix import operation emailProvider and custom email provider action dependencies [#1005]
- Fix dependency update proxy agent [#1010]

## [8.4.1] - 2024-12-16

### Fixed

- Fix importing forms, flows and flow vault connections dependencies[#1001]
- Fix docs for support of rendering `prompt` screen's settings [#1002]

## [8.4.0] - 2024-12-09

### Added

- Add support for rendering `prompt` screen's settings [#998]

## [8.3.0] - 2024-11-28

### Added

- Management support for `selfServiceProfiles` [#989]

### Fixed

- Fix checkpoint pagination to get all organizations [#984]
- Fix error handling for trigger bindings [#991]

## [8.2.0] - 2024-11-18

### Added

- Management support for `forms`, `flows` and `flowVaultConnections` [#982]

### Fixed

- Fix docs to support free tier usage [#978]

## [8.1.0] - 2024-11-08

### Added

- Client Credentials (M2M) support in `organizations` and `clientGrants` [#975]

## [8.0.0] - 2024-10-21

### Changed

- Auth0 [v4.X](https://github.com/auth0/node-auth0/releases/tag/v4.10.0) migration
- The `delete` operation on the `emailProvider` resource will disable the email provider instead of deleting it.

### Deprecated

- Migration resource operation

### Security

- Security fixes from dependencies
- Node 18 LTS and newer LTS releases are supported.

  Doc: [v8 Migartion](./docs/v8_MIGRATION_GUIDE.md)

## [7.24.3] - 2024-10-15

### Fixed

- Fix keyword replacement for `actions secrets` using the directory format [#954]
- Fix keyword replacement for `custom prompts` using the directory format [#963]

## [7.24.2] - 2024-08-28

### Added

- Add support for `login-passwordless` prompt on `partials` in prompts handler [#946]

### Fixed

- Fix `branding` template `path` on export/import [#943]
- Fix docs for support `exclusions of individual resource` [#944]

## [7.24.1] - 2024-08-09

### Fixed

- Fix `branding` template `path` on export/import as Yaml [#939]
- Fix `databases` handler to handle `options` property correctly for flexible identifiers [#937]

## [7.24.0] - 2024-08-02

### Added

- Management support for `partials` in `prompts` handler [#930]

### Changed

- Reduced latency while performing `SCIM` CRUD operations [#933]

## [7.23.1] - 2024-07-19

### Fixed

- Fix `429`(`too_many_requests`) and `403`(`insufficient_scope`) errors in the SCIM handler [#925]

## [7.23.0] - 2024-07-16

### Added

- Management support for `scim_configuration` in connections handler [#921]

## [7.22.1] - 2024-06-24

### Fixed

- Made `captcha_widget_theme` an optional field in the `colors` property within the `themes` schema [#911]

## [7.22.0] - 2024-06-21

### Added

- Management support for `is_signup_enabled` in organization connections [#905]
- Management support for `captcha_widget_theme` in theme colors [#906]

## [7.21.0] - 2024-02-08

### Added

- `show_as_button` management support for organization connections [#889]

### Fixed

- Strip `sink.azurePartnerTopic` field from payload when creating log stream [#876]

## [7.20.0] - 2023-11-29

### Added

- Relative path import support for actions directory handler [#866]

### Fixed

- Keyword preservation for wider array of resources [#864]
- Fetching clients if not defined when managing client grants in YAML format [#865]

## [7.19.0] - 2023-08-11

### Added

- Support for Private Key JWT authentication for authenticating with private key instead of client secret [#817]

### Fixed

- Process branding changes after theme changes to prevent delay in dashboard preview [#836]
- Handling eventual hooks and rules deprecation [#838]
- Overwrites occurring when preserving keywords within multiple client grants [#837]

## [7.18.0] - 2023-07-14

### Added

- Support for `password-reset-post-challenge` action trigger [#818]

### Fixed

- Runtime error when attempting to preserve keyword on null remote assets [#822]
- Respect email template `body` filepath definition [#820]

## [7.17.7] - 2023-07-07

### Fixed

- Delay processing of action triggers until deployed actions register [#809]
- Process custom domains prior to branding settings [#811]

## [7.17.6] - 2023-06-23

### Changed

- Improve handling of custom text prompts, reducing high-volume errors and timeouts by leveraging connection pooling for controlled execution [#804]

## [7.17.5] - 2023-06-08

### Fixed

- Obfuscating sensitive log streams keys [#800]
- Prevent exporting of disallowed tenant flags [#799]

## [7.17.4] - 2023-06-06

### Fixed

- Prevent tenant flag "Additional properties not allowed" error by only updating publicly-available feature flags [#797]

## [7.17.3] - 2023-05-24

### Fixed

- Keyword preservation for client grant `audience` field [#793]

## [7.17.2] - 2023-04-19

### Fixed

- API error when no tenant flags defined [#780]
- Keyword preservation in a resource's identifier fields [#784]

## [7.17.1] - 2023-03-31

### Fixed

- Tenant-agnostic filenames for client grants if more than fifty clients and fifty resource servers [#764]
- Unintentional exclusion of clients when injecting access token via `AUTH0_ACCESS_TOKEN` [#775]

## [7.17.0] - 2023-03-03

### Added

- Keyword preservation on export to prevent overwriting of keyword markers in most instances. Enabled through the `AUTH0_PRESERVE_KEYWORDS` boolean configuration property. See also: [Preserving Keywords on Export](./docs/keyword-replacement.md#preserving-keywords-on-export) [#738],[#740],[#741],[#744],[#745],[#751],[#754],[#757],[#758],[#760]

### Fixed

- Enabled wrapping of `@@ARRAY_REPLACE@@` keyword markers with single quotes in YAML resource configuration files [#760]

## [7.16.1] - 2023-02-07

### Fixed

- Exporting of multiple client grants for a single client when using directory format [#729]
- Tenant-agnostic client grant files when exporting using directory format [#729]

## [7.16.0] - 2023-02-01

### Added

- `AUTH0_INCLUDED_ONLY` configuration property to express sole management of certain resource types [#726]
- Suspended log stream management support [#725]
- More descriptive errors when actions service is unavailable [#724]

### Fixed

- Remove configurable tenant `sandbox_version` property from readonly list [#683]
- Handling of undefined tenant `enabled_locales` property [#727]

## [7.15.2] - 2023-01-03

### Fixed

- Deletion of email provider when setting as empty object [#673]

### Security

- Upgraded `node-auth0` which addresses [vulnerability reported](https://github.com/advisories/GHSA-hjrf-2m68-5959) for `jsonwebtoken` package

## [7.15.1] - 2022-10-19

### Added

- Warning about future fix that enables deletion of email provider; no significant changes to functionality [#672]

### Fixed

- Returning all branding setting when using YAML [#666]
- Preventing empty `logo_url` from update tenant payload [#667]
- Loading actions between different operating systems [#668]
- Prevent writing undefined page templates files [#671]

## [7.15.0] - 2022-10-11

### Added

- Ignoring management of marketplace actions because they are unsupported by the Management API [#660]

### Fixed

- Allowing partial attack protection configurations [#638]

## [7.14.3] - 2022-08-24

### Fixed

- Reclassify select production dependencies as dev dependencies [#626]
- Allowing certain page templates configuration to be modified even when absent of HTML [#629],[#630]

## [7.14.2] - 2022-08-01

### Fixed

- Allowing updating of branding themes when used in conjunction with `--export_ids` flag [#603]
- Halting deploy process if passwordless email template does not exist [#617]

## [7.14.1] - 2022-06-29

### Fixed

- Reverting unreplaced keyword mapping detection that would trigger some false-positives [#597]

## [7.14.0] - 2022-06-27

### Added

- Validation to detect unreplaced keyword mappings during import [#591]

### Fixed

- Detect and prevent `You are not allowed to set flag '<SOME_FLAG>' for this tenant.` errors when erroneously setting non-configurable migration flag [#590]
- Crash when attempting to create page templates from undefined value [#592]

## [7.13.1] - 2022-06-13

### Fixed

- Removing single usage of `flatMap` array method to prevent crashes with Node v10 [#577]

## [7.13.0] - 2022-06-06

### Added

- Themes support (if supported by tenant) [#554]

### Fixed

- Omit `enabled_clients` from connection payload if not defined in resource configuration files [#563]

## [7.12.3] - 2022-05-24

### Fixed

- Resource exclusion respected during import even if resource configuration exists [#545]
- Environment variables ingested by default [#553]

## [7.12.2] - 2022-05-17

### Fixed

- Properly handle all screen types within a prompt grouping [#541]
- Gracefully ignoring custom domains if not supported by tenant [#542]

## [7.12.1] - 2022-05-11

### Fixed

- Unable to deploy without branding settings feature [#532]

## [7.12.0] - 2022-05-10

### Added

- Prompts support (both prompts settings and custom text for prompts) [#530]
- Custom domains support [#527]

## [7.11.1] - 2022-05-04

### Fixed

- Deployment of newly-created actions always failing due to "A draft must be in the 'built' state" error [#524]
- Undefined `updateRule` Auth0 SDK alias replaced with operational `rules.update` [#526]

## [7.11.0] - 2022-04-28

### Added

- Intelligent scope detection, will skip resources when insufficient scope provided to designated application [#517]

### Fixed

- Inconsistencies between resource handlers with respect to empty, null and undefined values [#512]

## [7.10.0] - 2022-04-26

### Added

- Branding support for directory format [#505]

### Fixed

- More comprehensive support for deletions through `AUTH0_ALLOW_DELETE` [#509]

## [7.9.0] - 2022-04-19

### Added

- Log streams support [#495]

### Fixed

- `##` String keyword replacements now work when nested inside `@@` array replacements [#504]

## [7.8.0] - 2022-04-14

### Added

- Type declarations for more seamless integration into Typescript projects when used as a module [#485]

### Security

- Updated Winston from 2.3.x to 3.3.0 which applies fix for theoretical prototype pollution vulnerability [#497]

## [7.7.1] - 2022-04-07

### Added

- Deprecation warnings for now deprecated asset-specific exclusion configuration properties: `AUTH0_EXCLUDED_RULES`, `AUTH0_EXCLUDED_CLIENTS`, `AUTH0_EXCLUDED_DATABASES`, `AUTH0_EXCLUDED_CONNECTIONS`, `AUTH0_EXCLUDED_RESOURCE_SERVERS`, `AUTH0_EXCLUDED_DEFAULTS`. See [Resource Exclusion Proposal](https://github.com/auth0/auth0-deploy-cli/issues/451#user-content-deprecated-exclusion-props) for details. [#481]

### Fixed

- Rules configs failing to update after regression prevented asset-specific overrides of Node Auth0 SDK methods [#482]
- Attack protection not replacing keywords [#478]

## [7.7.0] - 2022-04-06

### Added

- Exclusion of entire resource types via the `AUTH0_EXCLUDED` configuration parameter. See [Resource Exclusion Proposal](https://github.com/auth0/auth0-deploy-cli/issues/451) for details. [#468]

### Fixed

- `idle_session_lifetime` and `session_lifetime` values properly ignored on update if inheriting default tenant values.[#471]

## [7.6.0] - 2022-03-25

### Added

- New branding template feature support [#438]

### Fixed

- Colliding `e` parameter alias between `export_ids` and `env` [#453]

## [7.5.2] - 2022-03-15

### Fixed

- Resetting this version to be latest on NPM

## [7.5.1] - 2022-03-11

### Fixed

- Updating dead link in logging output [#436]
- Fixing `--env` flag to properly dictate environment variable inheritance [#432]

## [7.5.0] - 2022-03-08

### Added

- Support for attack protection configuration management [#428]

### Fixed

- Excluded connection properties from getting deleted upon update [#430]
- Organizations in YAML format are skipped when not defined [#388]

## [7.4.0] - 2022-02-24

### Added

- Allowing @@ array variable replacement to work when wrapped in quotes [#421]

### Fixed

- Eliminated benign `client_metadata` warnings on import [#416]
- Fixing request abstraction from losing function scope, enabling Auth0 Node SDK updates [#412]

### Security

- Updating Auth0 Node SDK to 2.40.0 which fixes minor dependency vulnerability

## [7.3.7] - 2022-02-03

### Fixed

- Expose errors that may be silently missed in Actions [#408]

## [7.3.6] - 2022-02-02

### Fixed

- Fix errors caused by incompatibilities introduced by new versions of Auth0 SDK [#406]

## [7.3.5] - 2022-01-27

### Fixed

- Fix an error with the function context [#403]

## [7.3.4] - 2022-01-26

### Fixed

- Fix pagination [#401]

## [7.3.3] - 2022-01-26

### Fixed

- Fix pagination [#400]

### Security

- Security fixes from dependencies

## [7.3.2] - 2021-12-14

### Security

- Fixes dependency security issues

## [7.3.1] - 2021-09-21

### Fixed

- Error when authenticating with AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET with Node.js prior to v14

## [7.3.0] - 2021-09-20

### Added

- Allow set of AUTH0_AUDIENCE for custom domain [#379] (credit @AliBazzi)

### Fixed

- Load file configured in customScripts for DB Connections [#367] (credit @skukx)

### Security

- Security fixes from dependencies

## [7.2.1] - 2021-08-23

### Fixed

- [IDS-3074] Updated structure when dumping orgs (#369)

  Fixes an issue when exporting organizations as a directory, connections are not structured in the right way, causing the import to remove any connection on the organizations.

- [DXEX-1721] Fix client metadata property deletion

  Fixes an inconsistency between how we calculate changes on deep metadata-like objects and with how APIv2 expects such changes to be expressed when a property is deleted.

- Bump js-yaml from 3.x to 4.x and move to kacl (#371)

  This PR bumps js-yaml from 3.x to 4.x in accordance with its migration guide. This bump means that we're able to use the default safe behaviour for both exports and imports.

  Notably, this means that we won't end up with values like !<tag:yaml.org,2002:js/undefined> '' that are not at all human friendly and were problematic when we used the .safeLoad functionality.

## [7.2.0] - 2021-07-14

### Added

- Add runtime property for actions [#364]

## [7.1.1] - 2021-06-23

### Added

- Export tools module

### Fixed

- Fix exception when actions is undefined [#361]
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
[#361]: https://github.com/auth0/auth0-deploy-cli/issues/361
[#364]: https://github.com/auth0/auth0-deploy-cli/issues/364
[#367]: https://github.com/auth0/auth0-deploy-cli/issues/367
[#379]: https://github.com/auth0/auth0-deploy-cli/issues/379
[#388]: https://github.com/auth0/auth0-deploy-cli/issues/388
[#400]: https://github.com/auth0/auth0-deploy-cli/issues/400
[#401]: https://github.com/auth0/auth0-deploy-cli/issues/401
[#403]: https://github.com/auth0/auth0-deploy-cli/issues/403
[#406]: https://github.com/auth0/auth0-deploy-cli/issues/406
[#408]: https://github.com/auth0/auth0-deploy-cli/issues/408
[#412]: https://github.com/auth0/auth0-deploy-cli/issues/412
[#416]: https://github.com/auth0/auth0-deploy-cli/issues/416
[#421]: https://github.com/auth0/auth0-deploy-cli/issues/421
[#428]: https://github.com/auth0/auth0-deploy-cli/issues/428
[#430]: https://github.com/auth0/auth0-deploy-cli/issues/430
[#432]: https://github.com/auth0/auth0-deploy-cli/issues/432
[#436]: https://github.com/auth0/auth0-deploy-cli/issues/436
[#438]: https://github.com/auth0/auth0-deploy-cli/issues/438
[#453]: https://github.com/auth0/auth0-deploy-cli/issues/453
[#468]: https://github.com/auth0/auth0-deploy-cli/issues/468
[#471]: https://github.com/auth0/auth0-deploy-cli/issues/471
[#478]: https://github.com/auth0/auth0-deploy-cli/issues/478
[#481]: https://github.com/auth0/auth0-deploy-cli/issues/481
[#482]: https://github.com/auth0/auth0-deploy-cli/issues/482
[#485]: https://github.com/auth0/auth0-deploy-cli/issues/485
[#495]: https://github.com/auth0/auth0-deploy-cli/issues/495
[#497]: https://github.com/auth0/auth0-deploy-cli/issues/497
[#504]: https://github.com/auth0/auth0-deploy-cli/issues/504
[#505]: https://github.com/auth0/auth0-deploy-cli/issues/505
[#509]: https://github.com/auth0/auth0-deploy-cli/issues/509
[#512]: https://github.com/auth0/auth0-deploy-cli/issues/512
[#517]: https://github.com/auth0/auth0-deploy-cli/issues/517
[#524]: https://github.com/auth0/auth0-deploy-cli/issues/524
[#526]: https://github.com/auth0/auth0-deploy-cli/issues/526
[#527]: https://github.com/auth0/auth0-deploy-cli/issues/527
[#530]: https://github.com/auth0/auth0-deploy-cli/issues/530
[#532]: https://github.com/auth0/auth0-deploy-cli/issues/532
[#541]: https://github.com/auth0/auth0-deploy-cli/issues/541
[#542]: https://github.com/auth0/auth0-deploy-cli/issues/542
[#545]: https://github.com/auth0/auth0-deploy-cli/issues/545
[#553]: https://github.com/auth0/auth0-deploy-cli/issues/553
[#554]: https://github.com/auth0/auth0-deploy-cli/issues/554
[#563]: https://github.com/auth0/auth0-deploy-cli/issues/563
[#577]: https://github.com/auth0/auth0-deploy-cli/issues/577
[#590]: https://github.com/auth0/auth0-deploy-cli/issues/590
[#591]: https://github.com/auth0/auth0-deploy-cli/issues/591
[#592]: https://github.com/auth0/auth0-deploy-cli/issues/592
[#597]: https://github.com/auth0/auth0-deploy-cli/issues/597
[#603]: https://github.com/auth0/auth0-deploy-cli/issues/603
[#617]: https://github.com/auth0/auth0-deploy-cli/issues/617
[#626]: https://github.com/auth0/auth0-deploy-cli/issues/626
[#629]: https://github.com/auth0/auth0-deploy-cli/issues/629
[#630]: https://github.com/auth0/auth0-deploy-cli/issues/630
[#638]: https://github.com/auth0/auth0-deploy-cli/issues/638
[#660]: https://github.com/auth0/auth0-deploy-cli/issues/660
[#666]: https://github.com/auth0/auth0-deploy-cli/issues/666
[#667]: https://github.com/auth0/auth0-deploy-cli/issues/667
[#668]: https://github.com/auth0/auth0-deploy-cli/issues/668
[#671]: https://github.com/auth0/auth0-deploy-cli/issues/671
[#672]: https://github.com/auth0/auth0-deploy-cli/issues/672
[#673]: https://github.com/auth0/auth0-deploy-cli/issues/673
[#683]: https://github.com/auth0/auth0-deploy-cli/issues/683
[#724]: https://github.com/auth0/auth0-deploy-cli/issues/724
[#725]: https://github.com/auth0/auth0-deploy-cli/issues/725
[#726]: https://github.com/auth0/auth0-deploy-cli/issues/726
[#727]: https://github.com/auth0/auth0-deploy-cli/issues/727
[#729]: https://github.com/auth0/auth0-deploy-cli/issues/729
[#738]: https://github.com/auth0/auth0-deploy-cli/issues/738
[#740]: https://github.com/auth0/auth0-deploy-cli/issues/740
[#741]: https://github.com/auth0/auth0-deploy-cli/issues/741
[#744]: https://github.com/auth0/auth0-deploy-cli/issues/744
[#745]: https://github.com/auth0/auth0-deploy-cli/issues/745
[#751]: https://github.com/auth0/auth0-deploy-cli/issues/751
[#754]: https://github.com/auth0/auth0-deploy-cli/issues/754
[#757]: https://github.com/auth0/auth0-deploy-cli/issues/757
[#758]: https://github.com/auth0/auth0-deploy-cli/issues/758
[#760]: https://github.com/auth0/auth0-deploy-cli/issues/760
[#764]: https://github.com/auth0/auth0-deploy-cli/issues/764
[#775]: https://github.com/auth0/auth0-deploy-cli/issues/775
[#780]: https://github.com/auth0/auth0-deploy-cli/issues/780
[#784]: https://github.com/auth0/auth0-deploy-cli/issues/784
[#793]: https://github.com/auth0/auth0-deploy-cli/issues/793
[#797]: https://github.com/auth0/auth0-deploy-cli/issues/797
[#799]: https://github.com/auth0/auth0-deploy-cli/issues/799
[#800]: https://github.com/auth0/auth0-deploy-cli/issues/800
[#804]: https://github.com/auth0/auth0-deploy-cli/issues/804
[#809]: https://github.com/auth0/auth0-deploy-cli/issues/809
[#811]: https://github.com/auth0/auth0-deploy-cli/issues/811
[#817]: https://github.com/auth0/auth0-deploy-cli/issues/817
[#818]: https://github.com/auth0/auth0-deploy-cli/issues/818
[#820]: https://github.com/auth0/auth0-deploy-cli/issues/820
[#822]: https://github.com/auth0/auth0-deploy-cli/issues/822
[#836]: https://github.com/auth0/auth0-deploy-cli/issues/836
[#837]: https://github.com/auth0/auth0-deploy-cli/issues/837
[#838]: https://github.com/auth0/auth0-deploy-cli/issues/838
[#864]: https://github.com/auth0/auth0-deploy-cli/issues/864
[#865]: https://github.com/auth0/auth0-deploy-cli/issues/865
[#866]: https://github.com/auth0/auth0-deploy-cli/issues/866
[#876]: https://github.com/auth0/auth0-deploy-cli/issues/876
[#889]: https://github.com/auth0/auth0-deploy-cli/issues/889
[#905]: https://github.com/auth0/auth0-deploy-cli/issues/905
[#906]: https://github.com/auth0/auth0-deploy-cli/issues/906
[#911]: https://github.com/auth0/auth0-deploy-cli/issues/911
[#921]: https://github.com/auth0/auth0-deploy-cli/issues/921
[#925]: https://github.com/auth0/auth0-deploy-cli/issues/925
[#930]: https://github.com/auth0/auth0-deploy-cli/issues/930
[#933]: https://github.com/auth0/auth0-deploy-cli/issues/933
[#937]: https://github.com/auth0/auth0-deploy-cli/issues/937
[#939]: https://github.com/auth0/auth0-deploy-cli/issues/939
[#943]: https://github.com/auth0/auth0-deploy-cli/issues/943
[#944]: https://github.com/auth0/auth0-deploy-cli/issues/944
[#946]: https://github.com/auth0/auth0-deploy-cli/issues/946
[#954]: https://github.com/auth0/auth0-deploy-cli/issues/954
[#963]: https://github.com/auth0/auth0-deploy-cli/issues/963
[#975]: https://github.com/auth0/auth0-deploy-cli/issues/975
[#978]: https://github.com/auth0/auth0-deploy-cli/issues/978
[#982]: https://github.com/auth0/auth0-deploy-cli/issues/982
[#984]: https://github.com/auth0/auth0-deploy-cli/issues/984
[#989]: https://github.com/auth0/auth0-deploy-cli/issues/989
[#991]: https://github.com/auth0/auth0-deploy-cli/issues/991
[#998]: https://github.com/auth0/auth0-deploy-cli/issues/998
[#1001]: https://github.com/auth0/auth0-deploy-cli/issues/1001
[#1002]: https://github.com/auth0/auth0-deploy-cli/issues/1002
[#1005]: https://github.com/auth0/auth0-deploy-cli/issues/1005
[#1007]: https://github.com/auth0/auth0-deploy-cli/issues/1007
[#1008]: https://github.com/auth0/auth0-deploy-cli/issues/1008
[#1009]: https://github.com/auth0/auth0-deploy-cli/issues/1009
[#1010]: https://github.com/auth0/auth0-deploy-cli/issues/1010
[#1014]: https://github.com/auth0/auth0-deploy-cli/issues/1014
[#1016]: https://github.com/auth0/auth0-deploy-cli/issues/1016
[#1017]: https://github.com/auth0/auth0-deploy-cli/issues/1017
[#1021]: https://github.com/auth0/auth0-deploy-cli/issues/1021
[#1022]: https://github.com/auth0/auth0-deploy-cli/issues/1022
[#1023]: https://github.com/auth0/auth0-deploy-cli/issues/1023
[#1026]: https://github.com/auth0/auth0-deploy-cli/issues/1026
[#1027]: https://github.com/auth0/auth0-deploy-cli/issues/1027
[#1028]: https://github.com/auth0/auth0-deploy-cli/issues/1028
[#1030]: https://github.com/auth0/auth0-deploy-cli/issues/1030
[#1031]: https://github.com/auth0/auth0-deploy-cli/issues/1031
[#1032]: https://github.com/auth0/auth0-deploy-cli/issues/1032
[#1035]: https://github.com/auth0/auth0-deploy-cli/issues/1035
[#1038]: https://github.com/auth0/auth0-deploy-cli/issues/1038
[#1039]: https://github.com/auth0/auth0-deploy-cli/issues/1039
[#1040]: https://github.com/auth0/auth0-deploy-cli/issues/1040
[#1041]: https://github.com/auth0/auth0-deploy-cli/issues/1041
[#1046]: https://github.com/auth0/auth0-deploy-cli/issues/1046
[#1047]: https://github.com/auth0/auth0-deploy-cli/issues/1047
[#1053]: https://github.com/auth0/auth0-deploy-cli/issues/1053
[#1054]: https://github.com/auth0/auth0-deploy-cli/issues/1054
[#1061]: https://github.com/auth0/auth0-deploy-cli/issues/1061
[#1062]: https://github.com/auth0/auth0-deploy-cli/issues/1062
[#1063]: https://github.com/auth0/auth0-deploy-cli/issues/1063
[#1064]: https://github.com/auth0/auth0-deploy-cli/issues/1064
[#1071]: https://github.com/auth0/auth0-deploy-cli/issues/1071
[#1072]: https://github.com/auth0/auth0-deploy-cli/issues/1072
[#1079]: https://github.com/auth0/auth0-deploy-cli/issues/1079
[#1084]: https://github.com/auth0/auth0-deploy-cli/issues/1084
[#1085]: https://github.com/auth0/auth0-deploy-cli/issues/1085
[#1086]: https://github.com/auth0/auth0-deploy-cli/issues/1086
[#1093]: https://github.com/auth0/auth0-deploy-cli/issues/1093
[#1095]: https://github.com/auth0/auth0-deploy-cli/issues/1095
[#1096]: https://github.com/auth0/auth0-deploy-cli/issues/1096
[#1103]: https://github.com/auth0/auth0-deploy-cli/issues/1103
[#1104]: https://github.com/auth0/auth0-deploy-cli/issues/1104
[#1109]: https://github.com/auth0/auth0-deploy-cli/issues/1109
[#1115]: https://github.com/auth0/auth0-deploy-cli/issues/1115
[#1116]: https://github.com/auth0/auth0-deploy-cli/issues/1116
[#1121]: https://github.com/auth0/auth0-deploy-cli/issues/1121
[#1123]: https://github.com/auth0/auth0-deploy-cli/issues/1123
[#1124]: https://github.com/auth0/auth0-deploy-cli/issues/1124
[Unreleased]: https://github.com/auth0/auth0-deploy-cli/compare/v8.10.0...HEAD
[8.10.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.9.0...v8.10.0
[8.9.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.8.3...v8.9.0
[8.8.3]: https://github.com/auth0/auth0-deploy-cli/compare/v8.8.2...v8.8.3
[8.8.2]: https://github.com/auth0/auth0-deploy-cli/compare/v8.8.1...v8.8.2
[8.8.1]: https://github.com/auth0/auth0-deploy-cli/compare/v8.8.0...v8.8.1
[8.8.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.7.1...v8.8.0
[8.7.1]: https://github.com/auth0/auth0-deploy-cli/compare/v8.7.0...v8.7.1
[8.7.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.6.2...v8.7.0
[8.6.2]: https://github.com/auth0/auth0-deploy-cli/compare/v8.6.1...v8.6.2
[8.6.1]: https://github.com/auth0/auth0-deploy-cli/compare/v8.6.0...v8.6.1
[8.6.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.5.0...v8.6.0
[8.5.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.4.4...v8.5.0
[8.4.4]: https://github.com/auth0/auth0-deploy-cli/compare/v8.4.3...v8.4.4
[8.4.3]: https://github.com/auth0/auth0-deploy-cli/compare/v8.4.2...v8.4.3
[8.4.2]: https://github.com/auth0/auth0-deploy-cli/compare/v8.4.1...v8.4.2
[8.4.1]: https://github.com/auth0/auth0-deploy-cli/compare/v8.4.0...v8.4.1
[8.4.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.3.0...v8.4.0
[8.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.2.0...v8.3.0
[8.2.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.1.0...v8.2.0
[8.1.0]: https://github.com/auth0/auth0-deploy-cli/compare/v8.0.0...v8.1.0
[8.0.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.24.3...v8.0.0
[7.24.3]: https://github.com/auth0/auth0-deploy-cli/compare/v7.24.2...v7.24.3
[7.24.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.24.1...v7.24.2
[7.24.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.24.0...v7.24.1
[7.24.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.23.1...v7.24.0
[7.23.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.23.0...v7.23.1
[7.23.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.22.1...v7.23.0
[7.22.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.22.0...v7.22.1
[7.22.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.21.0...v7.22.0
[7.21.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.20.0...v7.21.0
[7.20.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.19.0...v7.20.0
[7.19.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.18.0...v7.19.0
[7.18.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.7...v7.18.0
[7.17.7]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.6...v7.17.7
[7.17.6]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.5...v7.17.6
[7.17.5]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.4...v7.17.5
[7.17.4]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.3...v7.17.4
[7.17.3]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.2...v7.17.3
[7.17.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.1...v7.17.2
[7.17.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.17.0...v7.17.1
[7.17.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.16.1...v7.17.0
[7.16.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.16.0...v7.16.1
[7.16.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.15.2...v7.16.0
[7.15.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.15.1...v7.15.2
[7.15.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.15.0...v7.15.1
[7.15.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.14.3...v7.15.0
[7.14.3]: https://github.com/auth0/auth0-deploy-cli/compare/v7.14.2...v7.14.3
[7.14.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.14.1...v7.14.2
[7.14.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.14.0...v7.14.1
[7.14.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.13.1...v7.14.0
[7.13.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.13.0...v7.13.1
[7.13.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.12.3...v7.13.0
[7.12.3]: https://github.com/auth0/auth0-deploy-cli/compare/v7.12.2...v7.12.3
[7.12.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.12.1...v7.12.2
[7.12.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.12.0...v7.12.1
[7.12.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.11.1...v7.12.0
[7.11.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.11.0...v7.11.1
[7.11.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.10.0...v7.11.0
[7.10.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.9.0...v7.10.0
[7.9.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.8.0...v7.9.0
[7.8.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.7.1...v7.8.0
[7.7.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.7.0...v7.7.1
[7.7.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.6.0...v7.7.0
[7.6.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.5.2...v7.6.0
[7.5.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.5.1...v7.5.2
[7.5.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.5.0...v7.5.1
[7.5.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.4.0...v7.5.0
[7.4.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.7...v7.4.0
[7.3.7]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.6...v7.3.7
[7.3.6]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.5...v7.3.6
[7.3.5]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.4...v7.3.5
[7.3.4]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.3...v7.3.4
[7.3.3]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.2...v7.3.3
[7.3.2]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.1...v7.3.2
[7.3.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.3.0...v7.3.1
[7.3.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.2.1...v7.3.0
[7.2.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.2.0...v7.2.1
[7.2.0]: https://github.com/auth0/auth0-deploy-cli/compare/v7.1.1...v7.2.0
[7.1.1]: https://github.com/auth0/auth0-deploy-cli/compare/v7.1.0...v7.1.1
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
