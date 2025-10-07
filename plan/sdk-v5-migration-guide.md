# Auth0 Management SDK v4 → v5 Migration Guide

## Test Handler Migration Context & Patterns

**Last Updated:** October 7, 2025  
**Progress:** 22/~45 handlers complete, 232 tests passing  
**Repository:** auth0/auth0-deploy-cli  
**Branch:** DXCDT-1234-migration-node-auth-v5

---

## Quick Start Prompt Template

When starting a new migration session, use this prompt:

```
Continue SDK v5 migration for auth0-deploy-cli handler tests.

Current status: [X] handlers complete, [Y] tests passing
Next handler to fix: [handler_name]

Apply established SDK v5 patterns:
1. Check handler source for exact API methods used
2. Apply manual transformations for sub-client structures
3. Fix response unwrapping (SDK v5 returns data directly)
4. Update method signatures (delete/update take id directly)
5. Run tests and verify all passing

Refer to plan/sdk-v5-migration-guide.md for detailed patterns.
```

---

## Migration Progress Tracker

### ✅ Completed Handlers (22 total, 232 tests)

| #   | Handler              | Tests | Key SDK Changes                                          | Notes                          |
| --- | -------------------- | ----- | -------------------------------------------------------- | ------------------------------ |
| 1   | actions              | 10    | `getAll()` → `list()`                                    | Response unwrapping            |
| 2   | attackProtection     | 8     | Breached password detection methods                      | Complex nested configs         |
| 3   | branding             | 13    | `getBranding()` → `get()`                                | Settings object                |
| 4   | clientGrants         | 7     | Standard CRUD                                            | Simple conversion              |
| 5   | clients              | 18    | Standard CRUD                                            | Large test file                |
| 6   | connections          | 22    | Standard CRUD                                            | Password policy handling       |
| 7   | customDomains        | 5     | Standard CRUD                                            | Domain verification            |
| 8   | databases            | 14    | Database connection methods                              | Custom scripts                 |
| 9   | emailProvider        | 10    | Provider-specific methods                                | Configuration handling         |
| 10  | emailTemplates       | 5     | Template CRUD                                            | HTML handling                  |
| 11  | flows                | 5     | Flow management                                          | New feature                    |
| 12  | flowVaultConnections | 5     | Vault connection methods                                 | New feature                    |
| 13  | forms                | 5     | Form management                                          | New feature                    |
| 14  | guardian             | 11    | MFA factor methods                                       | Multiple sub-resources         |
| 15  | hooks                | 10    | Hook management                                          | Deprecated, migrate to actions |
| 16  | logStreams           | 8     | Stream management                                        | Provider configs               |
| 17  | migrations           | 8     | Migration flags                                          | Boolean operations             |
| 18  | resourceServers      | 19    | API resource management                                  | Scope handling                 |
| 19  | roles                | 9     | `roles.permissions.{add,delete,list}`                    | **SUB-CLIENT**                 |
| 20  | themes               | 8     | `branding.themes.{getDefault,create,update,delete}`      | **SUB-CLIENT**                 |
| 21  | tenant               | 9     | `tenants.settings.{get,update}`                          | **SUB-CLIENT**                 |
| 22  | triggers             | 8     | `actions.triggers.{list}` + `bindings.{list,updateMany}` | **NESTED SUB-CLIENT**          |

### ❌ Skipped/Abandoned

| Handler             | Reason                                                                                             | Complexity                                 |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| selfServiceProfiles | `selfServiceProfiles.customText.{list,set}` nested sub-client too complex for automated conversion | HIGH - requires manual expert intervention |

### 🔄 Remaining Handlers (~23 handlers, est. 150-180 tests)

- organizations
- pages
- prompts
- rules
- rulesConfigs
- And ~18 more handlers

---

## Core SDK v5 Changes

### 1. **Method Renames**

```javascript
// SDK v4
client.getAll();
client.create(data);
client.update({ id }, data);
client.delete({ id });

// SDK v5
client.list();
client.create(data);
client.update(id, data); // id is string, not object
client.delete(id); // id is string, not object
```

### 2. **Response Unwrapping**

```javascript
// SDK v4 - Wrapped responses
const result = await client.getAll();
// result = { data: [...] }

// SDK v5 - Direct responses
const result = await client.list();
// result = [...] (array directly)
```

**Test Implications:**

```javascript
// OLD (SDK v4)
auth0.clients.getAll: () => Promise.resolve({ data: clients })

// NEW (SDK v5)
auth0.clients.list: () => Promise.resolve(clients)
```

### 3. **Sub-Client Structures**

SDK v5 introduced sub-clients for related resources:

#### Simple Sub-Clients (1 level)

```javascript
// roles.permissions
roles.permissions.add(roleId, { permissions });
roles.permissions.delete(roleId, { permissions });
roles.permissions.list(roleId);

// branding.themes
branding.themes.getDefault();
branding.themes.create(data);
branding.themes.update(themeId, data);
branding.themes.delete(themeId);

// tenants.settings
tenants.settings.get();
tenants.settings.update(data);
```

#### Nested Sub-Clients (2 levels)

```javascript
// actions.triggers.bindings
actions.triggers.list();
actions.triggers.bindings.list(triggerId);
actions.triggers.bindings.updateMany(triggerId, { bindings });

// selfServiceProfiles.customText (COMPLEX - ABANDONED)
selfServiceProfiles.customText.list(profileId);
selfServiceProfiles.customText.set(profileId, language, data);
```

---

## Proven Migration Workflow

### Step 1: Identify Handler API Methods

```bash
# Grep the handler source to find exact API methods
grep -n "this\.client\." src/tools/auth0/handlers/[handler].ts
```

**Example output:**

```
55:    this.client.actions.triggers.list()
62:    this.client.actions.triggers.bindings.list(triggerId)
115:   this.client.actions.triggers.bindings.updateMany(name, { bindings })
```

### Step 2: Check Current Test Status

```bash
npm test -- --grep "[handler] handler"
```

Look for errors indicating:

- `Cannot read properties of undefined (reading 'X')` → Missing sub-client
- `target[name] is not a function` → Method rename needed
- Test failures on assertions → Response unwrapping needed

### Step 3: Apply Transformations

#### For Simple Method Renames (No Sub-Clients)

```bash
# Use sed for bulk transformations
sed -i '' 's/getAll:/list:/g' test/tools/auth0/handlers/[handler].tests.js
sed -i '' 's/{ data: /{ /g' test/tools/auth0/handlers/[handler].tests.js
```

#### For Sub-Client Structures (Manual Required)

**DON'T use sed** - it creates malformed nested structures.

**DO manually edit** using replace_string_in_file:

```javascript
// BEFORE
const auth0 = {
  roles: {
    getPermissions: (params) => Promise.resolve({ data: permissions }),
    addPermissions: () => Promise.resolve([]),
  },
  pool,
};

// AFTER
const auth0 = {
  roles: {
    permissions: {
      list: (roleId) => Promise.resolve(permissions),
      add: (roleId, { permissions }) => Promise.resolve([]),
    },
  },
  pool,
};
```

**Key Points:**

- Add proper closing braces for each sub-client level
- Remove `{ data: ... }` wrappers
- Update method signatures (id as string, not object)
- Keep `pool` and other properties at correct nesting level

### Step 4: Verify Tests Pass

```bash
npx ts-mocha -p tsconfig.json test/tools/auth0/handlers/[handler].tests.js --timeout 5000
```

**Success criteria:**

- All tests passing (e.g., "8 passing (11ms)")
- No errors in output
- Log statements show proper CRUD operations

---

## Common Transformation Patterns

### Pattern 1: Standard CRUD (No Sub-Clients)

```javascript
// Transformations needed:
getAll → list
get → get (unchanged)
create → create (unchanged)
update({id}, data) → update(id, data)
delete({id}) → delete(id)

// Response unwrapping:
Promise.resolve({ data: items }) → Promise.resolve(items)
Promise.resolve({ data: item }) → Promise.resolve(item)
```

### Pattern 2: Sub-Client with CRUD

```javascript
// Example: branding.themes

// OLD
branding: {
  getDefaultTheme: () => Promise.resolve({ data: theme }),
  createTheme: (data) => Promise.resolve({ data: theme }),
  updateTheme: ({themeId}, data) => Promise.resolve({ data: theme }),
  deleteTheme: ({themeId}) => Promise.resolve({}),
}

// NEW
branding: {
  themes: {
    getDefault: () => Promise.resolve(theme),
    create: (data) => Promise.resolve(theme),
    update: (themeId, data) => Promise.resolve(theme),
    delete: (themeId) => Promise.resolve({}),
  },
}
```

### Pattern 3: Nested Sub-Client

```javascript
// Example: actions.triggers.bindings

// OLD
actions: {
  getAllTriggers: () => Promise.resolve(triggersMap),
  getTriggerBindings: (params) => Promise.resolve({ bindings: [...] }),
  updateTriggerBindings: ({triggerId}, {bindings}) => Promise.resolve([]),
}

// NEW
actions: {
  triggers: {
    list: () => Promise.resolve(['trigger1', 'trigger2']),
    bindings: {
      list: (triggerId) => Promise.resolve([...bindings]),
      updateMany: (triggerId, {bindings}) => Promise.resolve([]),
    },
  },
}
```

### Pattern 4: Singleton Resources

```javascript
// Example: tenant settings, email provider

// OLD
tenants: {
  getSettings: () => Promise.resolve({ data: settings }),
  updateSettings: (data) => Promise.resolve({ data: settings }),
}

// NEW
tenants: {
  settings: {
    get: () => Promise.resolve(settings),
    update: (data) => Promise.resolve(settings),
  },
}
```

---

## Method Signature Reference

### Update Methods

```javascript
// SDK v4
client.update({ id: 'abc123' }, { name: 'New Name' });
client.update({ id: 'abc123', property: 'value' }, data);

// SDK v5
client.update('abc123', { name: 'New Name' });
// First param is id string, second is data object
```

### Delete Methods

```javascript
// SDK v4
client.delete({ id: 'abc123' });

// SDK v5
client.delete('abc123');
// Just the id string
```

### List Methods with Params

```javascript
// SDK v4
client.getAll({ page: 0, per_page: 50 });

// SDK v5
client.list({ page: 0, per_page: 50 });
// Params unchanged, just method rename
```

---

## Sub-Client Mapping Reference

### Known Sub-Client Structures

| Parent Client         | Sub-Client    | Methods                                    | Notes                           |
| --------------------- | ------------- | ------------------------------------------ | ------------------------------- |
| `roles`               | `permissions` | `add`, `delete`, `list`                    | Permission management           |
| `branding`            | `themes`      | `getDefault`, `create`, `update`, `delete` | Theme CRUD                      |
| `tenants`             | `settings`    | `get`, `update`                            | Singleton settings              |
| `actions`             | `triggers`    | `list`                                     | Trigger types list              |
| `actions.triggers`    | `bindings`    | `list`, `updateMany`                       | **Nested** - binding management |
| `selfServiceProfiles` | `customText`  | `list`, `set`                              | **Complex** - abandoned         |

### Identifying Sub-Clients in Tests

Look for these error patterns:

```javascript
// Error: Cannot read properties of undefined (reading 'bindings')
// Indicates: actions.triggers.bindings expected but actions.triggers doesn't exist

// Error: Cannot read properties of undefined (reading 'permissions')
// Indicates: roles.permissions expected but roles doesn't have permissions sub-client
```

---

## Testing Patterns

### Test Structure

```javascript
describe('#[handler] handler', () => {
  describe('#[Handler] validate', () => {
    // Validation tests
  });

  describe('#[handler] process', () => {
    // CRUD operation tests
    it('should create [resource]', async () => {
      const auth0 = {
        [client]: {
          create: () => Promise.resolve(resource),
        },
        pool,
      };
      // Test logic
    });
  });

  describe('#[handler] getType', () => {
    // Fetch existing resources tests
  });
});
```

### Mock Client Patterns

```javascript
// Standard mock
const auth0 = {
  clients: {
    list: () => Promise.resolve(clientList),
    create: (data) => Promise.resolve(data),
    update: (id, data) => Promise.resolve({ ...data, client_id: id }),
    delete: (id) => Promise.resolve({}),
  },
  pool,
  getAllCalled: false,
};

// Sub-client mock
const auth0 = {
  roles: {
    permissions: {
      list: (roleId) => Promise.resolve(permissionsList),
      add: (roleId, { permissions }) => Promise.resolve([]),
      delete: (roleId, { permissions }) => Promise.resolve([]),
    },
  },
  pool,
};
```

### Assertion Updates

```javascript
// OLD - SDK v4
const data = await handler.getType();
expect(data).to.deep.equal({ data: expectedData });

// NEW - SDK v5
const data = await handler.getType();
expect(data).to.deep.equal(expectedData);
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Using sed for Nested Structures

**Problem:** sed creates malformed brace structures

```javascript
// sed output - BROKEN
actions: {
  triggers: {
  list: () => {},
  bindings: {
    updateMany: () => {},
},  // ← Missing closing brace for triggers
```

**Solution:** Manual replacement with proper closing braces

```javascript
actions: {
  triggers: {
    list: () => {},
    bindings: {
      updateMany: () => {},
    },
  },
},
```

### ❌ Pitfall 2: Forgetting Response Unwrapping

**Problem:** Tests expect wrapped responses

```javascript
// Handler returns direct data
const data = await client.list(); // returns []

// Test expects wrapped
expect(data).to.deep.equal({ data: [] }); // FAILS
```

**Solution:** Update test expectations

```javascript
expect(data).to.deep.equal([]); // PASSES
```

### ❌ Pitfall 3: Incorrect Method Signatures

**Problem:** Passing id as object

```javascript
// SDK v5 expects string
client.delete({ id: 'abc123' }); // TypeError: id.id is not a function
```

**Solution:** Pass id directly

```javascript
client.delete('abc123'); // Works
```

### ❌ Pitfall 4: Missing pool/getAllCalled Properties

**Problem:** Nesting pool inside wrong object

```javascript
// BROKEN
actions: {
  triggers: {
    list: () => {},
    pool,  // ← Wrong nesting level
  },
}
```

**Solution:** Keep at correct level

```javascript
actions: {
  triggers: {
    list: () => {},
  },
},
pool,  // ← Correct level
getAllCalled: false,
```

---

## Handler-Specific Notes

### Roles Handler

- Uses `roles.permissions.{add, delete, list}` sub-client
- Permission operations take roleId as first param
- 9 tests covering validation and permission management

### Themes Handler

- Uses `branding.themes.{getDefault, create, update, delete}` sub-client
- Theme ID passed as string in update/delete
- Special handling for default theme vs custom themes
- 8 tests covering CRUD and feature flag checks

### Tenant Handler

- Uses `tenants.settings.{get, update}` sub-client
- Singleton resource (no ID needed)
- Special flag filtering logic (`removeUnallowedTenantFlags`)
- 9 tests covering settings updates and flag validation

### Triggers Handler

- Uses nested `actions.triggers.bindings.{list, updateMany}` sub-client
- `triggers.list()` returns array of trigger type strings
- `bindings.list(triggerId)` returns bindings for specific trigger
- `bindings.updateMany(triggerId, {bindings})` updates trigger bindings
- Response unwrapping critical: bindings returned directly, not wrapped
- 8 tests covering binding CRUD and error handling

### SelfServiceProfiles Handler

- **ABANDONED** - Too complex for current approach
- Uses `selfServiceProfiles.customText.{list, set}` sub-client
- Requires expert manual intervention
- File reverted to original state

---

## Verification Checklist

After fixing each handler, verify:

- [ ] All tests passing (no failures)
- [ ] No undefined reading errors
- [ ] Log output shows correct CRUD operations
- [ ] Response structures match expectations
- [ ] Method signatures use correct params (id as string)
- [ ] Sub-client structures properly closed
- [ ] `pool` and other properties at correct nesting level
- [ ] Update progress tracker in this document

---

## Next Steps for New Session

1. **Check current progress:**

   ```bash
   npm test | grep "passing"
   ```

2. **Find next handler to fix:**

   ```bash
   ls test/tools/auth0/handlers/*.tests.js | sort
   ```

3. **Apply workflow:**

   - Step 1: Grep handler source for API methods
   - Step 2: Check test status
   - Step 3: Apply transformations (manual for sub-clients)
   - Step 4: Verify tests pass

4. **Update this document** with new handler details

5. **Commit progress** regularly:
   ```bash
   git add test/tools/auth0/handlers/[handler].tests.js
   git commit -m "fix: migrate [handler] tests to SDK v5"
   ```

---

## Useful Commands

```bash
# Run all tests
npm test

# Run specific handler tests
npm test -- --grep "[handler] handler"

# Run tests directly with ts-mocha
npx ts-mocha -p tsconfig.json test/tools/auth0/handlers/[handler].tests.js --timeout 5000

# Search for API method usage in handler source
grep -n "this\.client\." src/tools/auth0/handlers/[handler].ts

# Check for sub-client patterns in test file
grep -n "sub-client\|nested" test/tools/auth0/handlers/[handler].tests.js

# Count passing tests across all handlers
npm test 2>&1 | grep -E "passing|failing"

# Find handlers not yet migrated
git diff --name-only master...HEAD | grep handlers
```

---

## Resources

- **SDK v5 Migration Guide:** https://github.com/auth0/node-auth0/blob/master/MIGRATION_GUIDE.md
- **Management API Docs:** https://auth0.com/docs/api/management/v2
- **Project Documentation:** See `/docs` directory in repo
- **Copilot Instructions:** `.github/copilot-instructions.md`

---

## Success Metrics

**Current State:**

- ✅ 22 handlers complete
- ✅ 232 tests passing
- ❌ 1 handler abandoned (selfServiceProfiles)
- 🔄 ~23 handlers remaining

**Target State:**

- ✅ ~45 handlers complete
- ✅ ~380-400 tests passing
- 🎯 All SDK v4 references removed
- 🎯 Clean test suite with no errors

---

## Migration Patterns Quick Reference

```javascript
// ═══════════════════════════════════════════════════════════════
// PATTERN 1: Standard CRUD (No Sub-Clients)
// ═══════════════════════════════════════════════════════════════
// OLD
clients: {
  getAll: () => Promise.resolve({ data: clients }),
  get: ({id}) => Promise.resolve({ data: client }),
  create: (data) => Promise.resolve({ data: client }),
  update: ({id}, data) => Promise.resolve({ data: client }),
  delete: ({id}) => Promise.resolve({}),
}

// NEW
clients: {
  list: () => Promise.resolve(clients),
  get: (id) => Promise.resolve(client),
  create: (data) => Promise.resolve(client),
  update: (id, data) => Promise.resolve(client),
  delete: (id) => Promise.resolve({}),
}

// ═══════════════════════════════════════════════════════════════
// PATTERN 2: Sub-Client (1 Level)
// ═══════════════════════════════════════════════════════════════
// OLD
roles: {
  getPermissions: (params) => Promise.resolve({ data: permissions }),
  addPermissions: (params, data) => Promise.resolve([]),
}

// NEW
roles: {
  permissions: {
    list: (roleId) => Promise.resolve(permissions),
    add: (roleId, {permissions}) => Promise.resolve([]),
  },
}

// ═══════════════════════════════════════════════════════════════
// PATTERN 3: Nested Sub-Client (2 Levels)
// ═══════════════════════════════════════════════════════════════
// OLD
actions: {
  getAllTriggers: () => Promise.resolve(triggers),
  getTriggerBindings: (params) => Promise.resolve({ bindings: [] }),
  updateTriggerBindings: (params, data) => Promise.resolve([]),
}

// NEW
actions: {
  triggers: {
    list: () => Promise.resolve(triggers),
    bindings: {
      list: (triggerId) => Promise.resolve([]),
      updateMany: (triggerId, {bindings}) => Promise.resolve([]),
    },
  },
}

// ═══════════════════════════════════════════════════════════════
// PATTERN 4: Singleton Resource
// ═══════════════════════════════════════════════════════════════
// OLD
tenants: {
  getSettings: () => Promise.resolve({ data: settings }),
  updateSettings: (data) => Promise.resolve({ data: settings }),
}

// NEW
tenants: {
  settings: {
    get: () => Promise.resolve(settings),
    update: (data) => Promise.resolve(settings),
  },
}
```

---

**End of Migration Guide**

_Keep this document updated as you progress through the migration. It will serve as the single source of truth for SDK v5 migration patterns and decisions._
