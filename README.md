<div align="center">
  <h1>Auth0 Deploy CLI</h1>

[![npm version](https://badge.fury.io/js/auth0-deploy-cli.svg)](https://badge.fury.io/js/auth0-deploy-cli)
[![CircleCI](https://circleci.com/gh/auth0/auth0-deploy-cli/tree/master.svg?style=svg)](https://circleci.com/gh/auth0/auth0-deploy-cli/tree/master)
[![codecov](https://codecov.io/gh/auth0/auth0-deploy-cli/branch/master/graph/badge.svg)](https://codecov.io/gh/auth0/auth0-deploy-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

The Auth0 Deploy CLI is a tool that helps you manage your Auth0 tenant configuration. It integrates into your development workflows as a standalone CLI or as a node module.

**Supported resource types:** actions, branding, client grants, clients (applications), connections, custom domains, email templates, emails, grants, guardian, hook secrets, hooks, log streams, migrations, organizations, pages, prompts, resource servers (APIs), roles, rules, rules configs, tenant settings, themes.

## Highlights

- **Multi-Environment Oriented:** Designed to help you test your applications' Auth0 integrations from feature branch all the way to production.
- **Keyword Replacement:** Shared resource configurations across all environments with dynamic keyword replacement.
- **Versatile:** Integrate into your CI/CD workflows either as a CLI or as a Node module.

## Documentation

- [Using as a CLI](docs/using-as-cli.md)
- [Using as a Node Module](docs/using-as-node-module.md)
- [Configuring the Deploy CLI](docs/configuring-the-deploy-cli.md)
- [Keyword Replacement](docs/keyword-replacement.md)
- [Incorporating Into Multi-environment Workflows](docs/multi-environment-workflow.md)
- [Excluding Resources From Management](docs/excluding-from-management.md)
- [Resource-specific Documentation](docs/resource-specific-documentation.md)
- [Available Resource Formats](docs/available-resource-config-formats.md)
- [Terraform Provider](docs/terraform-provider.md)
- [How to Contribute](docs/how-to-contribute.md)

## Getting Started

This guide will help you to a working implementation of the Deploy CLI tool used as a standalone CLI. There are three main steps before the Deploy CLI can be run:

1. [Create a Dedicated Auth0 Application](#create-a-dedicated-auth0-application)
2. [Configure the Deploy CLI](#configure-the-deploy-cli)
3. [Calling the Deploy CLI](#calling-the-deploy-cli)

> ⚠️ **NOTE:** This tool can be destructive to your Auth0 tenant. It is recommended to be familiar with the [`AUTH0_ALLOW_DELETE` configuration](docs/configuring-the-deploy-cli.md#auth0allowdelete) and to test on development tenants prior to using in production.

### Prerequisites

- [Node](https://nodejs.dev/) version 10 or greater
- [Auth0 Tenant](https://auth0.com/)

### Install the Deploy CLI

To run as a standalone command-line tool:

```shell
npm install -g auth0-deploy-cli
```

### Create a dedicated Auth0 Application

In order for the Deploy CLI to call the Management API, a dedicated Auth0 application must be created to make calls on behalf of the tool.

1. From the Auth0 dashboard, navigate to **Applications > Applications**
2. Click “Create Application”
3. On Create application page:
   a. Name it “Deploy CLI” or similar
   b. Select “Machine to Machine Applications” as application type
   c. Click “Create”
4. On the “Authorize Machine to Machine Application” page
   a. Select “Auth0 Management API”
   b. Select the appropriate permissions for the resources you wish to manage. Refer to the [Client Scopes](#client-scopes) section for more information.
   c. Click “Authorize”

> ⚠️ **NOTE:** The Deploy CLI's own client grant is unconfigurable by itself to [prevent potentially destructive changes](./docs/resource-specific-documentation.md#client-grants).

#### Client Scopes

The designated application needs to be granted scopes in order to allow the Deploy CLI to execute Management operations.

The principle of least privilege is abided, so it will operate within the set of permissions granted. At a minimum, `read:clients` need to be selected, but is is recommended to select `read:`, `create:` and `update:` permissions for all resource types within management purview. To enable deletions, the `delete:` scopes are also necessary.

### Configure the Deploy CLI

The Deploy CLI can be configured two ways, through a `config.json` file and through environment variables. The decision to choose one or both would depend on your specific use case and preferences. More comprehensive information about configuring the tool can be found on the [Configuring the Deploy CLI](docs/configuring-the-deploy-cli.md) page. However, for this example, the simplest way to get going is by setting the following environment variables:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`

These values can be found in the “Settings” tab within the Auth0 application created in the previous step.

### Calling the Deploy CLI

Finally, with above complete, the Deploy CLI export command can be run:

```shell
a0deploy export --format=yaml --output_folder=local
```

Once the process completes, observe the resource configuration files generated in the `local` directory. Then, run the import command, which pushes configuration from the local machine to your Auth0 tenant:

```shell
a0deploy import -c=config.json --input_file local/tenant.yaml
```

## Issue Reporting

For general support or usage questions, use the [Auth0 Community](https://community.auth0.com/tag/deploy-cli) forums or raise a [support ticket](https://support.auth0.com/). Only [raise an issue](https://github.com/auth0/auth0-deploy-cli/issues) if you have found a bug or want to request a feature.

**Do not report security vulnerabilities on the public GitHub issue tracker.** The [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy) details the procedure for disclosing security issues.

## What is Auth0?

Auth0 helps you to:

- Add authentication with [multiple sources](https://auth0.com/docs/authenticate/identity-providers), either social identity providers such as **Google, Facebook, Microsoft Account, LinkedIn, GitHub, Twitter, Box, Salesforce** (amongst others), or enterprise identity systems like **Windows Azure AD, Google Apps, Active Directory, ADFS, or any SAML identity provider**.
- Add authentication through more traditional **[username/password databases](https://auth0.com/docs/authenticate/database-connections/custom-db)**.
- Add support for **[linking different user accounts](https://auth0.com/docs/manage-users/user-accounts/user-account-linking)** with the same user.
- Support for generating signed [JSON Web Tokens](https://auth0.com/docs/secure/tokens/json-web-tokens) to call your APIs and **flow the user identity** securely.
- Analytics of how, when, and where users are logging in.
- Pull data from other sources and add it to the user profile through [JavaScript Actions](https://auth0.com/docs/customize/actions).

**Why Auth0?** Because you should save time, be happy, and focus on what really matters: building your product.

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more information.
