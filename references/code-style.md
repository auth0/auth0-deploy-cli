# Code Style Reference — auth0-deploy-cli

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Source files | camelCase | `clients.ts`, `attackProtection.ts` |
| Classes | PascalCase | `ClientsHandler`, `YAMLContext` |
| Methods / variables | camelCase | `processChanges`, `calcChanges` |
| Constants / env vars | UPPER_SNAKE_CASE | `AUTH0_ALLOW_DELETE` |
| Test files | `<name>.test.js` | `clients.test.js` |

## Handler Implementation Pattern

Every resource handler in `src/tools/auth0/handlers/` must implement four methods:

```typescript
class ResourceHandler extends DefaultHandler {
  // Fetch current state from Auth0 API
  async getType(): Promise<Asset[]> { ... }

  // Determine create / update / delete operations
  async calcChanges(assets: Assets): Promise<Changes> { ... }

  // Execute CRUD operations — must be a no-op in dry run
  async processChanges(assets: Assets, changes: Changes): Promise<void> { ... }

  // Validate assets before processing; base class provides a default
  async validate(assets: Assets): Promise<void> { ... }
}
```

> `dump()` / export formatting is handled by `YAMLContext` and `DirectoryContext`, not by handlers.

Register the handler in `src/tools/constants.ts`. Handler schemas are defined inline in the handler file and aggregated by `src/tools/auth0/schema.ts`.

## Identifiers

```typescript
// ✅ Stable name-based identifier
static identifiers = ['name'];

// ✅ ID alongside name (when the API uses both for matching)
static identifiers = ['client_id', 'name'];

// 🚫 Never — sole auto-generated UUID breaks cross-tenant portability
static identifiers = ['id'];
```

## Keyword Replacement

```yaml
# @@KEY@@ — JSON-stringified (arrays, objects, booleans, numbers)
allowed_clients: @@ALLOWED_CLIENTS@@

# ##KEY## — literal string substitution (plain strings only)
name: "##APP_NAME##"
```

Both patterns must be preserved in every new field that flows through export/import. Mixing them up causes silent corruption — a `##KEY##` around a JSON array produces invalid YAML.

## Good vs Bad Handler Example

**✅ Good — follows the pattern, respects dry-run and ALLOW_DELETE:**

```typescript
async processChanges(assets: Assets, changes: Changes): Promise<void> {
  if (this.config('AUTH0_ALLOW_DELETE')) {
    await Promise.all(changes.delete.map((r) => this.client.resource.delete({ id: r.id })));
  }
  await Promise.all(changes.create.map((r) => this.client.resource.create(r)));
  await Promise.all(changes.update.map((r) => this.client.resource.update({ id: r.id }, r)));
}
```

**❌ Bad — logs a secret, missing ALLOW_DELETE guard:**

```typescript
async processChanges(assets: Assets, changes: Changes): Promise<void> {
  console.log('client_secret:', assets.clients[0].client_secret); // never log secrets
  // missing AUTH0_ALLOW_DELETE check — deletes happen unconditionally
  await Promise.all(changes.delete.map((r) => this.client.clients.delete({ client_id: r.client_id })));
}
```

## @order() Decorator

Handlers run in dependency order. Set `@order(N)` so that handlers whose resources are depended upon by others run first:

```typescript
@order(30)  // runs after Connections (20) and before Rules (40)
export default class ClientsHandler extends DefaultHandler { ... }
```

Wrong order causes 404s or constraint errors mid-deploy.

## Adding a New Resource Handler

1. Create handler in `src/tools/auth0/handlers/<resource>.ts`
2. Extend `DefaultHandler` and implement all four methods (`getType`, `calcChanges`, `processChanges`, `validate`)
3. Add the resource type constant to `src/tools/constants.ts`
4. Define the JSON schema inline in the handler; it is aggregated by `src/tools/auth0/schema.ts`
5. Write unit tests in `test/tools/auth0/handlers/<resource>.test.js`
6. Add E2E test coverage if applicable (or document why it's not possible)
7. Update `docs/resource-specific-documentation.md` and `examples/` to demonstrate the new resource

## Context Parser Details

- **DirectoryContext** (`src/context/directory/`): loads each resource type from separate nested JSON files
- **YAMLContext** (`src/context/yaml/`): parses a single `tenant.yaml` file with all resources inline
- Both support `@@KEY@@` and `##KEY##` keyword substitution
- Context tests use temporary directories with fixtures in `test/context/{directory,yaml}/`

## Configuration and Error Handling

**Config priority order:** CLI args → env vars → config files → defaults

**Error handling conventions:**
- Use `ValidationError` from `src/tools/validationError.ts` for all validation failures
- Validate early, before making API calls
- Preserve context when bubbling errors up the call stack
- Provide clear, actionable error messages

## Architecture: Request Flow

```
src/index.ts            CLI entry — routes export / import commands
src/commands/           import.ts, export.ts — load config and context
src/tools/deploy.ts     Orchestrate deployment across all handlers
src/tools/auth0/handlers/*  Resource-specific getType / calcChanges / processChanges
src/tools/auth0/client.ts   Management API calls via the auth0 npm SDK
```
