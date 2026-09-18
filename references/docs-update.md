# Docs Update Rules — auth0-deploy-cli

## Tracked Docs Inventory

| Doc | Status | Covers |
|-----|--------|--------|
| `README.md` | present | Installation, quick-start, prerequisites, CLI usage, configuration options, environment variables, contributing |
| `EXAMPLES.md` | ❌ missing | Create when adding a new integration pattern or command example |
| `examples/yaml/` | present | Sample YAML-format tenant configuration |
| `examples/directory/` | present | Sample directory-format tenant configuration |

## Code-to-Docs Mapping (CLI tool)

This is a CLI tool. The public surface is **commands, subcommands, and flags** — not exported functions.

| When this changes | Update these docs |
|-------------------|------------------|
| A command or subcommand added, removed, or renamed | `README.md` (command reference / usage) |
| A flag or argument added, removed, renamed, or its default changed | `README.md` (command reference), `examples/` (affected invocations) |
| Output format or exit-code behavior changed | `README.md` (usage), `examples/` |
| A new resource type added or removed | `README.md` (supported resources section), `examples/yaml/` and `examples/directory/` (add sample config) |
| A new config field or env var added | `README.md` (configuration / environment variables section) |
| A new keyword replacement pattern or behavior | `README.md` (keyword replacement section) |

> When you touch code that maps to a doc above, update that doc **in the same PR** — do not defer.

> `CHANGELOG.md` is maintained as part of the release flow — do not add changelog entries during feature development; they are cut at release time via the release process.

## Additional Reference Docs

- `docs/` — extended documentation including resource-specific docs; update `docs/resource-specific-documentation.md` when adding a new handler
- `docs/v8_MIGRATION_GUIDE.md` — v8 migration context; when making a breaking change, consult this pattern to author a versioned migration guide (filename inferred from the target major at the time of the change)
- `CONTRIBUTING.md` — contribution guidelines
- `.github/ISSUE_TEMPLATE/` — issue templates for bug reports and feature requests
