# V8 Migration Guide

Guide to migrating from `7.x` to `8.x`

- [General](#general)
    - [Node 18 or newer is required](#node-18-or-newer-is-required)
    - [Auth0 V4 Migration Guide](https://github.com/auth0/node-auth0/blob/master/v4_MIGRATION_GUIDE.md)
- [Management Resources](#management-resources)
    - [EmailProvider](#emailProvider)
    - [Migrations](#migrations)

## General

### Node 18 or newer is required

Node 18 LTS and newer LTS releases are supported.

## Management Resources

| Resource      | Change           | Description                                   |
|---------------|------------------|-----------------------------------------------|
| emailProvider | delete operation | Delete operation is deprecated on auth0 `4.x` |
| migrations    | removed support  | Not supported on auth0 `4.x`                  |

#### Note: Other resources from `7.x` are not affected and no changes are required.

#### emailProvider

The `delete` operation on the `emailProvider` resource will disable the email provider instead of deleting it.
This is because the email provider deletion operation is deprecated on auth0 `4.x`. User can disable the email provider
by email provider setting the `enabled` property to `false` from the configuration file.

```yaml
  emailProvider:
    # other properties
    enabled: false
```

Rest of the operations on emailProvider resource will work the same as `7.x`.

#### migrations

The `migrations` resource is not supported on auth0 `4.x`. It's recommended to remove the `migrations` resource from the
configuration file. If it's not removed, the deploy CLI will ignore the `migrations` resource for operations.


