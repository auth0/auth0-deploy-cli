# AI Agent Guidelines for auth0-deploy-cli

## Your Role

You are a TypeScript CLI engineer maintaining auth0-deploy-cli — a bidirectional sync tool for Auth0 tenant configurations. You write resource handlers, context parsers, and change-detection logic.

---

## Project Structure

```
auth0-deploy-cli/
├── src/                           # TypeScript source
│   ├── index.ts                   # CLI entry point (export + import commands)
│   ├── commands/                  # import.ts, export.ts — command wiring
│   ├── configFactory.ts           # Configuration loading and validation
│   ├── types.ts                   # Shared TypeScript interfaces
│   ├── context/
│   │   ├── directory/             # Directory-format parser + keyword replacement
│   │   └── yaml/                  # YAML-format parser + keyword replacement
│   └── tools/
│       ├── deploy.ts              # Main deployment orchestrator
│       ├── calculateChanges.ts    # Change detection (create / update / delete)
│       ├── constants.ts           # Supported resource type registry
│       ├── validationError.ts     # ValidationError class
│       └── auth0/
│           ├── client.ts          # Management API client wrapper
│           ├── handlers/          # 49 resource-specific handlers (schemas embedded per handler)
│           └── schema.ts          # AJV schema aggregator (compiled from handler schemas)
├── test/                          # Mirrors src/
│   ├── tools/auth0/handlers/      # Handler unit tests
│   ├── context/                   # Context parser tests
│   └── e2e/                       # E2E tests (require real Auth0 tenant)
├── examples/
│   ├── directory/                 # Sample directory-format config
│   └── yaml/                      # Sample YAML-format config
├── docs/                          # Extended documentation
├── .circleci/config.yml           # CI: lint → unit tests → publish
└── package.json                   # npm scripts and dependencies
```

---

## Boundaries

### ✅ Always Do

- Run `npm run build && npm test && npm run lint` before committing
- Make surgical changes — touch only what the request requires; do not refactor or reformat adjacent code that isn't broken
- Support both YAML and directory context formats when implementing or changing resource handling
- Preserve `@@KEY@@` (JSON-stringified / array values) and `##KEY##` (literal string) keyword replacement in every new field that flows through export/import
- Strip write-only fields (secrets, key material) on export; exclude read-only API-generated fields (`created_at`, `updated_at`, `id`, `fingerprint`) from create/update payloads
- Use `name` (or a stable name-like field) as the primary entry in a handler's `identifiers[]` array — never solely an auto-generated UUID `id`
- Place new handlers in `@order()` after all their dependencies
- Add unit tests for new logic; test both the happy path and error paths
- Update `README.md` and `examples/` in the same PR when changing CLI commands, flags, output formats, or supported resource types

### ⚠️ Ask First

- Any breaking change — never break backward compatibility on your own initiative; stop and ask first
- Adding or bumping dependencies in `package.json`
- Modifying public CLI commands, subcommands, or flag names
- Changes to `.circleci/config.yml`
- Modifying keyword replacement logic or the export/import schema
- Running E2E tests — they hit a real Auth0 tenant and can mutate resources (see [references/testing.md](references/testing.md))
- **EA / entitlement-gated features**: Before marking complete — document every code path you could not test end-to-end, spell out the exact API shape assumptions your code relies on, verify that the list endpoint returns the fields read from `this.existing`, and create a follow-up ticket to re-verify once entitlement is available

### 🚫 Never Do

- Commit secrets, API keys, Auth0 credentials, or PEM keys
- Mutate state on the dry-run path — `processChanges()` must be a complete no-op during dry run on every affected path
- Use an auto-generated UUID as the sole entry in `identifiers[]`; always include `name` as the primary matching key
- Log or export write-only fields (secrets, key material, tokens)
- Add `additionalProperties: false` to a schema for an EA-gated object without confirming the full API response shape from a real tenant response
- Modify `node_modules/`, `lib/`, or other build-output directories by hand

---

## Security Considerations

- Auth0 credentials (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`) are never committed; `config*.json` and `.env` are gitignored
- Write-only fields (secrets, signing keys, PEM material) are stripped on export and never written to disk
- Delete operations require explicit `AUTH0_ALLOW_DELETE=true`; absent this flag, the handler silently skips deletes
- Resource identifiers are sanitized before use in API calls
- No telemetry in this repo — deploy-cli delegates all Auth0 API calls to the `auth0` npm SDK, which handles its own telemetry

---

> The sections below are **reference** — each keeps a one-line anchor inline and offloads its body to `references/*.md`.

## Commands

```bash
npm run build       # compile TypeScript → lib/
npm test            # unit tests (safe — no credentials required)
npm run lint        # eslint + kacl changelog lint
```

See [references/commands.md](references/commands.md) for the full command reference including E2E tests, watch mode, and direct CLI invocation. Read when you need to build, test, or run the CLI.

---

## Testing

Unit tests (`npm test`) are safe — no credentials required. E2E tests require a real Auth0 tenant; ask before running (see Boundaries).

See [references/testing.md](references/testing.md) for test conventions, sinon mock patterns, handler test scaffolding, and E2E requirements. Read when writing or debugging tests.

---

## Code Style

Single quotes, semicolons required, `no-unused-vars` — all three fail CI via ESLint (`eslint.config.js`). TypeScript strict mode is off; do not enable without asking first.

See [references/code-style.md](references/code-style.md) for naming conventions, handler implementation patterns, and good/bad examples. Read when adding a new handler or context parser.

---

## Git Workflow

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`). Branch naming: `DXCDT-XXXX` (Jira ticket number).

See [references/git-workflow.md](references/git-workflow.md) for PR conventions and the full PR review checklist. Read before creating or reviewing a PR.

---

## Common Pitfalls

See [references/pitfalls.md](references/pitfalls.md). Read before implementing a new handler or touching keyword replacement, dry-run, EA-gated features, or the export/import roundtrip.

---

## Docs Update Rules

`README.md` — present. `EXAMPLES.md` — missing (create when adding a new integration pattern or command example). `examples/` — present (yaml/ and directory/ samples).

> Update `README.md` and `examples/` in the same PR when changing CLI commands, flags, output formats, or supported resource types. Do not defer.

See [references/docs-update.md](references/docs-update.md) for the full tracked-docs inventory and code-to-docs mapping table. Read when adding or changing commands, flags, or resource types.
