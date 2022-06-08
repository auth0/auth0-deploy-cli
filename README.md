<div align="center">
  <h1>Auth0 Deploy CLI</h1>
</div>

The Auth0 Deploy CLI is a tool that helps you manage your Auth0 tenant configuration. It integrates into your development workflows as a standalone CLI or as a node module.

**Supported resource types:** actions, branding, client grants, clients (applications), connections, custom domains, email templates, emails, grants, guardian, hook secrets, hooks, log streams, migrations, organizations, pages, prompts, resource servers (APIs), roles, rules, rules configs, tenant settings, themes

## Highlights

- **Multi-Environment Oriented:** Designed to help you test your applications' Auth0 integrations from feature branch all the way to production
- **Keyword Replacement:** Shared resource configurations across all environments with dynamic keyword replacement.
- **Versatile:** Integrate into your CI/CD workflows either as a CLI or as a Node module

## Documentation

- [Using as a CLI](#)
- [Using as a Node Module](#)
- [Configuring the Deploy CLI](#)
- [Keyword Replacement](#)
- [Incorporating Into Multi-environment Workflows](#)
- [Excluding from Management Purview](#)
- [Available Resource Formats](#)
- [Terraform Provider](#)
- [How to Contribute](#)

## Getting Started

This guide will help you to a working implementation of the Deploy CLI tool used as a standalone CLI. There are three main steps before the Deploy CLI can be run:

- Install the Deploy CLI tool
- Create a dedicated Auth0 application
- Configure the Deploy CLI

> ⚠️ **NOTE:** This tool can be destructive to your Auth0 tenant. It is recommended to be familiar with the [`AUTH0_ALLOW_DELETE` configuration](#) and to test on development tenants prior to using in production.

### Prerequisites

- [Node](https://nodejs.dev/) version 10 or greater
- An Auth0 tenant

### Install the Deploy CLI

To run as a standalone command-line tool:

```shell
npm install -g auth0-deploy-cli
```

### Create a Dedicated Auth0 Application

In order for the Deploy CLI to call the Management API, a dedicated Auth0 application must be created to make calls on behalf of the tool.

1. From the Auth0 dashboard, navigate to **Applications > Applications**
2. Click “Create Application”
3. On Create application page:
   - Name it “Deploy CLI” or similar
   - Select “Machine to Machine Applications” as application type
   - Click “Create”
4. On the “Authorize Machine to Machine Application” page
   - Select “Auth0 Management API”
   - Select the appropriate permissions for the resources you wish to manage. At a minimum, `read:clients` need to be selected, but is is recommended to select `read`, `create` and `update` permissions for most resources. Please refer to the [Permissions](#) section for more information.
   - Click “Authorize”

# Configure the Deploy CLI

The Deploy CLI can be configured two ways, through a `config.json` file and through environment variables. The decision to choose one or both would depend on your specific use case and preferences. More comprehensive information about configuring the tool can be found on the [Configuring the Deploy CLI](#) page. However, for this example, the simplest way to get going is by setting the following environment variables:

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
