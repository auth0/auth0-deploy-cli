- Start Date: March 14, 2022
- RFC PR: https://github.com/auth0/auth0-deploy-cli/pull/<PR_NUMBER>

# Summary

In this RFC, we propose a mechanism for excluding entire resources from the management purview of Deploy CLI.

Resource exclusion is an often requested feature from the community and has many legitimate use-cases. Currently, there is some resource-specific exclusion functionality, on a per-ID basis, but nothing that excludes entire resource types.


## Why Exclude?

Excluding entire resources are useful for developers who work on tenants with many of a certain type. In the case of hundreds or thousands of a type of resource, it may be operationally inconvenient to manage all of those configurations.

Additionally, exclusion is useful for organizations who provision certain resource types manually or through different API means, and they do not wish to automate that resource type under the purview of deploy CLI. 

It is understood that exclusions operate bi-directionally, meaning they work both on import and export. Currently, there is no clear use case for excluding resources for only one direction.

## Existing Methods of Exclusion

The following are existing configuration values for excluding resources on a per-ID basis:

  - `AUTH0_EXCLUDED_RULES`
  - `AUTH0_EXCLUDED_CLIENTS`
  - `AUTH0_EXCLUDED_DATABASES`
  - `AUTH0_EXCLUDED_CONNECTIONS`
  - `AUTH0_EXCLUDED_RESOURCE_SERVERS`

There are two problems these configurations though:

1. They only apply on a per-ID basis, meaning that there is no way to automatically exclude all of that certain resource. This is a minor inconvenience for a handful of a certain resource, however, in the case of hundreds or thousands of a certain resource, it becomes untenable.

Further, as more of a certain resource gets added, they'll necessarily need to be added to the Deploy CLI configuration, requiring more touch points.

2. This only covers a subset of all resources. The Auth0 Management API is still expanding in scope, 

Granted, it is possible to accommodate all n number of resource types with n number of exclusion properties, but can become unmanageable 


### Deprecation

The intention is to **eventually deprecate** these bespoke configurations.

The reasoning is, that the Deploy CLI is positioned as a bulk configuration management tool. While configurable to omit certain resources, it is best suited for migrating large sets of tenant configuration. For more bespoke and granular control over the purview of configuration management, the [Auth0 Terraform Provider](https://github.com/auth0-terraform-provider) may be a more appropriate tool for your workflow.

Further, omitting specific IDs from the management of this tool can have unintended and seemingly unpredictable consequences. Especially in the case of an entity depending on the existence of another. 

Deprecation will not be immediate and will begin initially by displaying warning notifications in the console. Developers will be encouraged to adopt the broader method of exclusion proposed in this document.

# Proposed Solution

The proposed solution is to introduce an `AUTH0_EXCLUDED` property in the JSON configuration file passed. This property will be an array of strings which contain the names of the resources that are intended for exclusion.

An example `config.json` file:

```json
{
    "AUTH0_DOMAIN": "<DOMAIN>",
    "AUTH0_CLIENT_ID": "<CLIENT_ID>",
    "AUTH0_CLIENT_SECRET": "<CLIENT_SECRET",
    "AUTH0_ALLOW_DELETE": false,
    "AUTH0_EXCLUDED": [
        "connections",
        "rules",
        "actions",
    ]
}
```

## Future Extensibility

Worth noting is that the proposed `AUTH0_EXCLUDED` property does yield a clear path for excluding specific IDs within a certain resource type in the future. This decision is intentional and meant to more clearly position this application as a bulk configuration management tool.

In the future however, it may be possible for this tool to include a `AUTH0_INCLUDED` property in combination with a wildcard operator available for `AUTH0_EXCLUDED`. Example:

```json
{
    "AUTH0_EXCLUDED": "*",
    "AUTH0_INCLUDED": [
        "connections",
        "rules",
        "actions",
    ]
}
```

This would open the possibility to flip application to an opt-in paradigm as opposed to the current opt-out behavior.


## Relevant Github Issues

- [Provide a way to exclude all of an object during a0deploy import · Issue #375](https://github.com/auth0/auth0-deploy-cli/issues/375)
- [Add config to exclude Actions - AUTH0_EXCLUDED_ACTIONS · Issue #397](https://github.com/auth0/auth0-deploy-cli/issues/397)
- [Ability to exclude objects when import/export using deploy-cli · Issue #394](https://github.com/auth0/auth0-deploy-cli/issues/394)
- [Allow skipping export of Organizations · Issue #427](https://github.com/auth0/auth0-deploy-cli/issues/427)


