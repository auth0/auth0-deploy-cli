# Testing Reference — auth0-deploy-cli

## Framework and Tools

- **Test runner**: Mocha 10.x (`ts-mocha` for TypeScript)
- **Stubs / spies**: sinon
- **Coverage**: nyc (Istanbul)
- **Test location**: `test/` (mirrors `src/` structure)
- **File pattern**: `test/**/*.test*` (excludes `test/e2e/`)
- **Timeout**: 20 000 ms per test

## Running Tests

```bash
# All unit tests (safe — no credentials)
npm test

# Single file
npx ts-mocha -p tsconfig.json test/tools/auth0/handlers/clients.test.js

# Pattern match
npm test -- --grep "should create client"

# With coverage report
npm run test:coverage
```

## Handler Test Scaffolding

```javascript
const mockClient = {
  clients: {
    getAll: sinon.stub().returns(mockPagedData([/* existing resources */])),
    create: sinon.stub().resolves({ client_id: 'abc', name: 'my-app' }),
    update: sinon.stub().resolves({}),
    delete: sinon.stub().resolves({}),
  },
};

const mockConfig = (key) => {
  const config = {
    AUTH0_ALLOW_DELETE: false,
    AUTH0_EXCLUDED_CLIENTS: [],
  };
  return config[key];
};
```

## Test Naming Convention

```javascript
describe('ClientsHandler', () => {
  it('should create a client when it does not exist', async () => { ... });
  it('should update a client when it already exists', async () => { ... });
  it('should not delete when AUTH0_ALLOW_DELETE is false', async () => { ... });
  it('should delete when AUTH0_ALLOW_DELETE is true', async () => { ... });
});
```

## Key Test Utilities

- `test/utils.js` — `mockPagedData()`, `buildStateObject()`, and other shared helpers
- `sinon.stub().resolves(value)` — async stubs
- `sinon.stub().returns(value)` — synchronous stubs (e.g. paged data iterators)

## What to Cover in Every Handler Test

- **Happy path**: normal create, update, delete with `AUTH0_ALLOW_DELETE=true`
- **No-delete guard**: `AUTH0_ALLOW_DELETE=false` produces zero deletes
- **Empty input**: empty asset arrays produce zero API calls
- **Idempotency**: deploy with unchanged config produces zero create/update/delete calls
- **Error path**: API call failure is surfaced (not swallowed)
- **Regression**: if fixing a bug, a test that would have caught the original bug

## Verifying Mocks

Always confirm the stub shape matches what the real API returns. A test named "should not delete" can pass silently for the wrong reason if the mock is wrong — verify the `sinon.stub()` is actually being called (or not called) via `sinon.assert`.

## E2E Test Requirements

> ⚠️ Ask before running — these mutate real tenant state.

```bash
# Node module E2E (uses HTTP recordings)
AUTH0_HTTP_RECORDINGS=lockdown npm run test:e2e:node-module

# CLI E2E (requires real tenant)
AUTH0_DOMAIN=<tenant> AUTH0_CLIENT_ID=<id> AUTH0_CLIENT_SECRET=<secret> npm run test:e2e:cli
```

Use a dedicated development tenant. Never run E2E against a production tenant.

## Configuration Testing

When testing resource exclusion and property filtering:

```javascript
const mockConfig = (key) => {
  const config = {
    AUTH0_ALLOW_DELETE: false,
    AUTH0_EXCLUDED: [],                    // resource types excluded entirely
    AUTH0_EXCLUDED_CLIENTS: ['my-app'],    // named exclusion per resource type
    EXCLUDED_PROPS: { clients: ['description'] }, // properties excluded from comparison
    INCLUDED_PROPS: { clients: ['name', 'app_type'] }, // properties included in comparison
  };
  return config[key];
};
```

- `AUTH0_EXCLUDED` — array of resource type strings to skip entirely
- `AUTH0_EXCLUDED_<TYPE>` — array of resource names to skip within a type
- `EXCLUDED_PROPS` — per-type list of properties to ignore during diff
- `INCLUDED_PROPS` — per-type allowlist; when set, only listed properties are compared
- Test keyword replacement by passing `AUTH0_KEYWORD_REPLACE_MAPPINGS` with a sample mapping and verifying the resolved value in the exported/imported asset
