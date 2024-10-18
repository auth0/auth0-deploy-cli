# V8 Migration Guide

Guide to migrating from `7.x` to `8.x`

- [General](#general)
  - [Node 18 or newer is required](#node-18-or-newer-is-required)
- [Management Resources](#management-resources)

## General

### Node 18 or newer is required

Node 18 LTS and newer LTS releases are supported.

## Management Resources

| Resource         | Change                        | Description                                   |
| ---------------- | ----------------------------- | --------------------------------------------- |
| actions          | No change                     | Same as `7.x`                                 |
| attackProtection | No change                     | Same as `7.x`                                 |
| branding         | No change                     | Same as `7.x`                                 |
| clientGrants     | No change                     | Same as `7.x`                                 |
| clients          | No change                     | Same as `7.x`                                 |
| connections      | No change                     | Same as `7.x`                                 |
| customDomains    | No change                     | Same as `7.x`                                 |
| emailProvider    | delete operation will disable | delete operation is deprecated on auth0 `4.x` |
| emailTemplates   | No change                     | Same as `7.x`                                 |
| guardian         | No change                     | Same as `7.x`                                 |
| logStreams       | No change                     | Same as `7.x`                                 |
| organizations    | No change                     | Same as `7.x`                                 |
| pages            | No change                     | Same as `7.x`                                 |
| prompts          | No change                     | Same as `7.x`                                 |
| resourceServers  | No change                     | Same as `7.x`                                 |
| migrations       | removed support               | Not supported on auth0 `4.x`                  |
| roles            | No change                     | Same as `7.x`                                 |
| rules            | Read only                     | Will be deprecated soon, migrate to actions   |
| rulesConfigs     | Read only                     | Will be deprecated soon, migrate to actions   |
| hooks            | Read only                     | Will be deprecated soon, migrate to actions   |
| tenant           | No change                     | Same as `7.x`                                 |
| themes           | No change                     | Same as `7.x`                                 |
| triggers         | No change                     | Same as `7.x`                                 |
