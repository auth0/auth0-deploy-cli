# Incorporating Into Multi-environment Workflows

The Deploy CLI supports working within a multi-tenant, multi-environment context. When integrated into your CI/CD development workflows, can be used to propagate Auth0 changes from feature development all the way through production.

In general, the advised workflow is as follows:

- Create a separate Auth0 tenant for each environment (ex: dev, staging, prod)
- Create a single repository of resource configuration files for all environments
- Add a step in your CI/CD pipeline when deploying to environments that applies the Auth0 resource configurations to the appropriate Auth0 tenant

## Tenant to Environment

It is recommended to have a separate Auth0 tenant/account for each environment you have. For example:

| Environment | Tenant        |
| ----------- | ------------- |
| Development | travel0-dev   |
| Testing     | travel0-uat   |
| Staging     | travel0-stage |
| Production  | travel0-prod  |

## Resource configuration repository

When exported, your Auth0 tenant state will be represented as a set of resource configuration files, either in a [YAML or JSON format](./available-resource-config-formats.md). In a multi-environment context it is expected to have a single repository of resource configurations that is applied to all environments. In practice, this may exist as a directory in your project’s codebase or in a separate codebase altogether.

You should have at least one branch for each tenant in your repository, which allows you to make changes without deploying them (the changes would only deploy when you merged your branch into the master, or primary, branch). With this setup, you can have a continuous integration task for each environment that automatically deploys changes to the targeted environment whenever the master branch receives updates.

Your workflow could potentially look something like this:

1. Make changes to development.
2. Merge changes to testing (or `uat`).
3. Test changes to `uat`. When ready, move and merge the changes to `staging`.
4. Test `staging`. When ready, move and merge the changes to `production`.

You may want to set your production environment to deploy only when triggered manually.

## Uni-directional Flow

The multi-environment workflow works best when changes are propagated “up” in a single direction. Changes to the resource configuration files should first be applied to the lowest level environment (ex: dev) and then incrementally applied up through all other environments until applied to production. This uni-directional practice ensures sufficient testing and approval for changes to your tenant. Once set, it is recommended to not apply configurations directly to production through other means such as the Auth0 Dashboard or Management API unless those changes are captured by a subsequent Deploy CLI export. Otherwise, those changes are subject to overwrite.

## Environment-specific values

While it is expected that all environments will share the same set of resource configuration files, environment-specific values can be expressed through separate tool configuration files and dynamic [keyword replacement](keyword-replacement.md).

### Separate Config Files

Specifying a separate tool configuration file per environment can be used to keep the resource configuration files agnostic of environment but still cater for the needs of each environment. At a minimum, you will need to provide separate credentials for each environment, but it is also possible to exclude certain resources, enable deletion and perform dynamic keyword replacement on a per-environment basis.

### Example file structure

```
project-root
│
└───auth0
│   │   config-dev.json   # Dev env config file
│   │   config-test.json  # Test env config file
│   │   config-prod.json  # Prod env config file
│   │   ... all other resource configuration files
│
└───src
    │   ... your project code
```

### Dynamic Values via Keyword Replacement

Once separate configurations files are adopted for each environment, keyword replacement via the `AUTH0_KEYWORD_REPLACE_MAPPINGS` configuration property can be used to express the dynamic replacement values depending on the environment. For example, you may find it necessary to have a separate set of allowed origins for your clients (see below). To learn more, see [Keyword Replacement](keyword-replacement.md).

#### Example `config-dev.json`

```json
{
  "AUTH0_DOMAIN": "travel0-dev.us.auth0.com",
  "AUTH0_CLIENT_ID": "PdwQpGy62sHcsV6ufZNEVrV4GDlDhm74",
  "AUTH0_ALLOW_DELETE": true,
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENV": "dev",
    "ALLOWED_ORIGINS": ["http://localhost:3000", "http://dev.travel0.com"]
  }
}
```

#### Example `config-prod.json`

```json
{
  "AUTH0_DOMAIN": "travel0.us.auth0.com",
  "AUTH0_CLIENT_ID": "vZCEFsDYzXc1x9IomB8dF185e4cdVah5",
  "AUTH0_ALLOW_DELETE": false,
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENV": "prod",
    "ALLOWED_ORIGINS": ["http://travel0.com"]
  }
}
```

---

[[table of contents]](../README.md#documentation)
