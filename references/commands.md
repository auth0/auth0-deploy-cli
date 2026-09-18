# Commands Reference — auth0-deploy-cli

## Setup

```bash
# Install dependencies (first-time setup)
npm install
```

## Build

```bash
# Compile TypeScript → lib/ (cleans lib/ first via rimraf)
npm run build

# Compile and watch (development)
npm run dev

# Type check only (no output)
npx tsc --noEmit
```

## Unit Tests

```bash
# Run all unit tests (safe — no credentials required)
npm test

# Run a specific test file
npx ts-mocha -p tsconfig.json test/tools/auth0/handlers/clients.test.js

# Run tests matching a pattern
npm test -- --grep "should create client"

# Run with coverage
npm run test:coverage
```

## Lint

```bash
# ESLint + kacl changelog lint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix
```

## E2E Tests

> ⚠️ These tests hit a real Auth0 tenant. Ask before running — see [Boundaries](../CLAUDE.md#boundaries).

```bash
# E2E as Node module (uses HTTP recordings)
AUTH0_HTTP_RECORDINGS=lockdown npm run test:e2e:node-module

# E2E as CLI (requires real tenant credentials)
npm run test:e2e:cli
```

Required environment variables for E2E:
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_HTTP_RECORDINGS=lockdown` (for node-module recording replay)

## Running the CLI Directly

```bash
# Always build first
npm run build

# Export tenant configuration
node lib/index.js export -c config.json -f directory -o ./local/
node lib/index.js export -c config.json -f yaml -o ./local-yaml/

# Import (deploy) configuration
node lib/index.js import -c config.json -i ./local/tenant.json
node lib/index.js import -c config.json -i ./local-yaml/tenant.yaml

# Enable debug logging
AUTH0_DEBUG=true node lib/index.js import -c config.json -i ./local/tenant.json
```

## Environment Variables Reference

```bash
AUTH0_DOMAIN                        # Tenant domain (e.g. my-tenant.auth0.com)
AUTH0_CLIENT_ID                     # Client ID for M2M application
AUTH0_CLIENT_SECRET                 # Client secret
AUTH0_ALLOW_DELETE=true             # Enable delete operations (default: false)
AUTH0_KEYWORD_REPLACE_MAPPINGS      # JSON object for @@KEY@@/##KEY## substitution
AUTH0_EXCLUDED                      # JSON array of resource types to skip
AUTH0_EXCLUDED_<TYPE>               # Exclude specific resources by name, e.g. AUTH0_EXCLUDED_CLIENTS
AUTH0_DEBUG=true                    # Enable verbose debug logging
AUTH0_HTTP_RECORDINGS=lockdown      # Replay HTTP recordings in E2E node-module tests
```
