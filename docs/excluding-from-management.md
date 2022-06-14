# Excluding Resources From Management

In many cases, you may find it useful to exclude resources from being managed. This could be because your tenant has a large number of a particular resource and thus it is operationally burdensome to manage. Other times, you may wish to exclude them as your development workflow only pertains to a specific subset of resources and you’d like to omit all other resources for performance. Regardless of the use case, there are several options available for expressing exclusions in the Deploy CLI.

## Excluding entire resources by type

For more complex tenants, you may find yourself wanting to omit entire resource types. Some common use cases for wanting this capability:

- Enterprise tenant with thousands of organizations, managing all would be operationally burdensome
- CI/CD process only focuses on managing roles, you may wish to exclude all others
- Feature development pertains to hook, you may wish to temporarily exclude all others to optimize performance

This type of exclusion is expressed by passing an array of resource names into the `AUTH0_EXCLUDED` configuration property. This exclusion works **bi-directionally**, that is, both when export from Auth0 and importing to Auth0, regardless if resource configuration files exist or not.

All supported resource values for exclusion:

`actions`, `attackProtection`, `branding`, `clientGrants`, `clients`, `connections`, `customDomains`, `databases`, `emailProvider`, `emailTemplates`, `guardianFactorProviders`, `guardianFactorTemplates`, `guardianFactors`, `guardianPhoneFactorMessageTypes`, `guardianPhoneFactorSelectedProvider`, `guardianPolicies`, `hooks`, `logStreams`, `migrations`, `organizations`, `pages`, `prompts`, `resourceServers`, `roles`, `rules`, `rulesConfigs`, `tenant`, `triggers`

### Example

The following example excludes `clients`, `connections`, `databases` and `organizations` from being managed by the Deploy CLI. However, this example is arbitrary and your use case may require you to exclude less or more types.

```json
{
  "AUTH0_DOMAIN": "example-site.us.auth0.com",
  "AUTH0_CLIENT_ID": "<YOUR_AUTH0_CLIENT_ID>",
  "AUTH0_EXCLUDED": ["clients", "connections", "databases", "organizations"]
}
```

## Excluding single resources by ID

Some resource types support exclusions of individual resource by ID. This is primarily useful if you work in a multi-environment context and wish to omit a production single, specific resource from your lower-level environments. The by-ID method of exclusion is supported for rules, clients, databases, connections and resource servers with the `AUTH0_EXCLUDED_RULES` ,`AUTH0_EXCLUDED_CLIENTS`, `AUTH0_EXCLUDED_DATABASES`, `AUTH0_EXCLUDED_CONNECTIONS`, `AUTH0_EXCLUDED_RESOURCE_SERVERS` configuration values respectively.

```json
{
  "AUTH0_DOMAIN": "example-site.us.auth0.com",
  "AUTH0_CLIENT_ID": "<YOUR_AUTH0_CLIENT_ID>",
  "AUTH0_EXCLUDED_CLIENTS": ["PdmQpGy72sHksV6ueVNZVrV4GDlDDm76"],
  "AUTH0_EXCLUDED_CONNECTIONS": ["con_O1H3KyRMFP1IWRq3", "con_9avEYuj19ihqKBOs"]
}
```

> ⚠️ **NOTE:** Excluding resources by ID is being considered for deprecation in future major versions. See the [resource exclusion proposal](https://github.com/auth0/auth0-deploy-cli/issues/451) for more details.

## Omitted vs excluded vs empty

The above sections pertain to exclusion which forcefully ignore configurations bi-directionally. It is worth noting similar but very different concepts: “omissions” and “empty” states.

### Omission

Resource configuration that is absent, either intentionally or unintentionally, will be skipped during import. That is, if you resource configuration were deleted, those configurations would be skipped during import and will not alter the remote tenant state. There is no concept of omission for exporting; unless specifically excluded, all your tenant configurations will be written to resource configuration files.

### Example of omission

```yaml
roles: # roles configuration is not omitted
  - name: Admin
    description: Can read and write things
    permissions: []
  - name: Reader
    description: Can only read things
    permissions: []
# The omission of all other configurations means they'll be skipped over
```

### Empty

Resource configuration that is explicitly defined as empty. For set-based configurations like hooks, organizations and actions, setting these configurations to an empty set expresses an intentional emptying of those resources. In practice, this would signal a deletion, so long as the [`AUTH0_ALLOW_DELETE` deletion configuration property](configuring-the-deploy-cli.md#AUTH0_ALLOW_DELETE) is enabled. For non-set-based resource configuration like tenant and branding, the concept of emptiness does not apply, will not trigger any deletions or removals.

#### Example of emptiness

```yaml
hooks: [] # Empty hooks
connections: [] # Empty connections
tenant: {} # Effectively a no-op, emptiness does not apply to non-set resource config
```

---

[[table of contents]](../README.md#documentation)
