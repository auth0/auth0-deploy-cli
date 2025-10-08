# AGENTS.md

## Project Overview

The Auth0 Deploy CLI is a TypeScript-based tool for managing Auth0 tenant configurations through bidirectional sync (export/import) operations. It supports both YAML and directory formats with dynamic keyword replacement for multi-environment workflows.

**Key Capabilities:**

- Export Auth0 tenant configurations to local files (YAML or directory structure)
- Import configurations from local files to Auth0 tenants
- Keyword replacement for multi-environment deployments
- Resource-specific handlers for 30+ Auth0 resource types

## Setup Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Build in watch mode during development
npm run dev

# Run unit tests
npm test

# Run E2E tests (requires Auth0 tenant)
npm run test:e2e:node-module
npm run test:e2e:cli

# Run linter
npm run lint
```

## Development Workflow

### Local Development Commands

Common operations for working with the CLI:

```bash
# Export tenant configuration to local/
npm run build && node lib/index.js export -c config-dev.json -f directory -o ./local/

# Import configuration
npm run build && node lib/index.js import -c config-dev.json -i ./local/tenant.json

# Export as YAML
npm run build && node lib/index.js export -c config-dev.json -f yaml -o ./local-export/

# Import from YAML
npm run build && node lib/index.js import -c config-dev.json -i ./local-export/tenant.yaml
```

### Build Process

- Source TypeScript files live in `src/`
- Compiled JavaScript output goes to `lib/` (published to npm)
- Always run `npm run build` before testing CLI changes
- Use `npm run dev` for watch mode during active development

### File Structure

```
src/                                # TypeScript source
├── index.ts                        # CLI entry point
├── commands/                       # import.ts, export.ts
├── tools/                          # Core logic (deploy.ts, calculateChanges.ts)
│   └── auth0/                      # Auth0 API integration
│       ├── handlers/               # 30+ resource-specific handlers
│       └── schema/                 # JSON validation schemas
└── context/                        # Format parsers (yaml/, directory/)

test/                               # Test suite mirrors src/
├── tools/auth0/handlers/          # Handler unit tests
├── context/                        # Context parser tests
└── e2e/                           # End-to-end tests
```

## Code Style & Conventions

### TypeScript Standards

- Use strict TypeScript configuration (`tsconfig.json`)
- Define types in `src/types.ts` for shared interfaces
- Follow existing patterns for handler implementations
- Use proper async/await patterns, avoid callbacks

### Handler Implementation Pattern

Every resource handler in `src/tools/auth0/handlers/` must implement:

```typescript
class ResourceHandler {
  validate(); // Schema validation using AJV
  processChanges(); // CRUD operations with API calls
  calcChanges(); // Determine create/update/delete ops
  dump(); // Format for export
  getType(); // Fetch from Auth0 API
}
```

### Configuration Management

- All environment variables prefixed with `AUTH0_`
- Config priority: CLI args → env vars → config files → defaults
- Support both direct values and JSON serialization for complex types

### Error Handling

- Use `ValidationError` class from `src/tools/validationError.ts`
- Provide clear, actionable error messages
- Preserve context when bubbling errors up
- Validate early before making API calls

## Testing Instructions

### Running Tests

```bash
# Unit tests only (fast)
npm test

# E2E tests as node module
npm run test:e2e:node-module

# E2E tests as CLI (requires real tenant credentials)
npm run test:e2e:cli
```

### Test Structure

- Unit tests mirror `src/` directory structure in `test/`
- Use `.test.js` or `.test.ts` extensions
- Handler tests use sinon stubs for Auth0 clients
- Context tests use temporary directories with fixtures
- E2E tests require real Auth0 tenant (configured via env vars)

### Writing Handler Tests

Pattern for testing resource handlers:

```javascript
const mockClient = {
  resource: {
    getAll: sinon.stub(),
    create: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
  },
};

const mockConfig = (key) => {
  const config = {
    AUTH0_ALLOW_DELETE: true,
    AUTH0_EXCLUDED: [],
  };
  return config[key];
};
```

### Test Coverage Requirements

- Add tests for any new handlers or features
- Test both success and error paths
- Check resource identifier mapping logic
- Test keyword replacement in context parsers

### Running Specific Tests

```bash
# Run specific test file
npm test -- test/tools/auth0/handlers/clients.test.js

# Run tests matching pattern
npm test -- --grep "should validate clients"
```

## Common Development Tasks

### Adding a New Resource Handler

1. Create handler in `src/tools/auth0/handlers/<resource>.ts`
2. Implement all required methods (validate, processChanges, dump, etc.)
3. Add resource type to `src/tools/constants.ts`
4. Create JSON schema in `src/tools/auth0/schema/`
5. Write unit tests in `test/tools/auth0/handlers/<resource>.test.js`
6. Add E2E test coverage if applicable
7. Update documentation in `docs/resource-specific-documentation.md`

### Working with Context Parsers

- **DirectoryContext** (`src/context/directory/`): Loads nested JSON files
- **YAMLContext** (`src/context/yaml/`): Parses single YAML file
- Both support keyword patterns: `@@KEY@@` (JSON-stringified) and `##KEY##` (literal)
- Test with fixtures in `test/context/{directory,yaml}/`

### Configuration Testing

- Mock config functions return expected values for each key
- Test resource exclusion with `AUTH0_EXCLUDED` and `AUTH0_EXCLUDED_*` patterns
- Test property exclusion with `EXCLUDED_PROPS` and `INCLUDED_PROPS`
- Verify keyword replacement mappings work correctly

## Pull Request Guidelines

### Before Committing

```bash
# Always run before commit
npm run build
npm test
npm run lint
```

### PR Checklist

- [ ] All tests pass locally
- [ ] New code has corresponding tests
- [ ] TypeScript compiles without errors
- [ ] Updated relevant documentation in `docs/`
- [ ] Added entry to `CHANGELOG.md` if user-facing change
- [ ] Tested with both YAML and directory formats if applicable
- [ ] Checked backward compatibility

### Commit Message Format

Follow conventional commits style:

- `feat: add support for new resource type`
- `fix: resolve table formatting issue`
- `docs: update handler implementation guide`
- `test: add coverage for keyword replacement`
- `refactor: simplify change calculation logic`

## Security Considerations

### API Credentials

- Never commit Auth0 credentials or API keys
- Config files with credentials should be gitignored
- Use environment variables for sensitive data
- Example configs use `.json.example` suffix

### Validation & Safety

- All resources validated against JSON schemas before processing
- Delete operations require explicit `AUTH0_ALLOW_DELETE=true`
- Resource identifiers properly sanitized before API calls

### Testing with Real Tenants

- Use dedicated development tenants for E2E tests
- Never run E2E tests against production tenants
- Credentials stored in environment variables only
- Clean up test resources after test runs

## Debugging Tips

### Enable Debug Logging

```bash
export AUTH0_DEBUG=true
npm run build && node lib/index.js import -c config.json
```

### Common Issues

- **Build errors**: Check `tsconfig.json` and ensure all imports resolve
- **Handler not found**: Verify resource added to `src/tools/constants.ts`
- **Schema validation fails**: Check JSON schema in `src/tools/auth0/schema/`
- **Keyword replacement not working**: Verify mappings in config and context parser

### Useful Commands

```bash
# Check compiled output
cat lib/index.js

# Test CLI directly
node lib/index.js export -c config.json --output_folder ./test-output

# Run with verbose errors
NODE_ENV=development npm test

# Check Auth0 API pagination
AUTH0_DEBUG=true npm run test:e2e:node-module
```

## Architecture Notes

### Request Flow

1. **CLI Entry** (`src/index.ts`) → Command routing
2. **Commands** (`src/commands/import.ts`) → Load config and context
3. **Deploy** (`src/tools/deploy.ts`) → Orchestrate deployment
4. **Handlers** (`src/tools/auth0/handlers/*`) → Resource-specific logic
5. **Auth0 Client** (`src/tools/auth0/client.ts`) → Management API calls

### Change Calculation

- Compare local assets (from YAML/directory) with remote state (from API)
- Use resource identifiers (name, id, etc.) to match resources
- Determine CREATE (new), UPDATE (changed), DELETE (removed) operations
- Respect exclusion patterns and allow-delete config

## Additional Resources

- **Full documentation**: See `docs/` directory
- **Examples**: Check `examples/yaml/` and `examples/directory/`
- **Contributing**: Read `CONTRIBUTING.md`
- **Migration guide**: See `docs/v8_MIGRATION_GUIDE.md`
- **Issue templates**: `.github/ISSUE_TEMPLATE/`

## Quick Reference

### Environment Variables

```bash
AUTH0_DOMAIN                        # Tenant domain
AUTH0_CLIENT_ID                     # Client ID
AUTH0_CLIENT_SECRET                 # Client secret
AUTH0_ALLOW_DELETE=true             # Enable deletions
AUTH0_KEYWORD_REPLACE_MAPPINGS      # JSON mapping for replacements
AUTH0_EXCLUDED                      # Array of resources to exclude
AUTH0_DEBUG=true                    # Verbose logging
```

### Key Files to Know

- `src/tools/deploy.ts` - Main deployment orchestrator
- `src/tools/calculateChanges.ts` - Change detection logic
- `src/tools/constants.ts` - Supported resource types
- `src/configFactory.ts` - Configuration management
- `src/types.ts` - TypeScript type definitions
- `test/utils.js` - Test helper functions
