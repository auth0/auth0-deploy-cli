# Git Workflow Reference — auth0-deploy-cli

## Branch Naming

`DXCDT-XXXX` (Jira ticket number) for feature and fix branches.

Examples: `DXCDT-2268`, `SDK-10176`

## Commit Messages

Conventional Commits format:

- `feat: add support for new resource type`
- `fix: resolve table formatting issue`
- `docs: update handler implementation guide`
- `test: add coverage for keyword replacement`
- `refactor: simplify change calculation logic`

## Pull Request Conventions

PR template is at `.github/PULL_REQUEST_TEMPLATE.md`. Sections:

- **Changes** — what was changed and why
- **References** — linked Jira ticket or GitHub issue
- **Testing** — what was tested, and any scenarios that could not be tested (EA / entitlement-gated)
- **Checklist** — tests pass, lint passes, docs updated, backward compatibility checked

## PR Review Checklist

> This is a living document. Add a new section, checklist item, or Lesson Learned whenever a real review surfaces a pattern worth capturing.

Work through every section in order. Do not skip sections because they seem irrelevant. Give a structured summary after all areas: issues found (grouped by severity), items that look good, and questions for the author.

### 1. Context & Purpose

- Does the PR description explain **why** this change is needed, not just what it does?
- Is there a linked issue? Does the PR actually close it?
- Is the scope reasonable — one thing, not many things?

### 2. Correctness

- Does the logic do what the description claims?
- Are early exits and guard clauses correct — not too broad, not too narrow?
- Are error paths handled? Does a failure in one step leave state inconsistent?
- Are there silent failures (swallowed errors, empty catch blocks)?
- Does the ordering of operations matter? Is it correct? (e.g. create before delete)

### 3. Edge Cases

- What happens with empty input / null / undefined?
- What happens when the resource already exists (idempotency)?
- What happens when a partial failure occurs mid-operation?
- Are there race conditions or ordering dependencies across handlers?

### 4. Backward Compatibility

- Does this break any existing config formats or file structures?
- Will existing users' export → deploy workflows still work unchanged?
- Are old config shapes (from before this PR) still handled gracefully?
- Does any new export format, when re-deployed unchanged, produce unintended side effects?

### 5. Safety & Destructive Operations

- Are destructive operations (delete, overwrite) gated by `ALLOW_DELETE`?
- Is the safety contract enforced in code on **all** paths — not just the obvious ones?
- Could a no-op deploy (nothing changed) still cause mutations?

### 6. Tests

- Are unit tests present for new logic?
- Do tests actually test what their names claim? Verify the mock matches the test name.
- Are critical/risky paths covered — not just the happy path?
- Are E2E tests present or updated? If not, is there a documented reason?
- Is there a regression test for the exact failure scenario the PR is fixing?
- Are there idempotency tests — running the same operation twice produces no extra changes?

### 7. Docs & Examples

- Is there a new config shape or feature? Are examples updated?
- Are example files (`examples/`, `tenant.yaml`) updated to demonstrate new functionality?
- Is the README or relevant documentation updated?
- Are new config fields, env vars, or flags documented?

### 8. Code Quality

- Is the code readable and does it follow existing patterns?
- Are there unnecessary type casts (`as any`, `as Function`) that bypass type safety?
- Is there dead code, unused imports, or leftover debug statements?
- Is mutation of shared state (e.g. assets objects) clearly intentional and safe?

### 9. Performance

- Are there N+1 patterns (API calls inside loops)?
- Could this cause rate limiting for large tenants?

### 10. Security

- Are sensitive values (secrets, PEM keys, tokens) ever logged or exported?
- Is user-controlled input validated before use?

### 11. deploy-cli Specific — verify all of these

- Does the change work in **both** YAML and directory formats?
- Is the dry-run path correct? Dry-run must never mutate state on any affected path.
- Is keyword replacement (`@@KEY@@` / `##KEY##`) preserved correctly for new fields?
- Are write-only fields (secrets, key material) stripped on export and never written to disk?
- Are read-only/API-generated fields (`created_at`, `updated_at`, `id`, `fingerprint`) stripped on export and excluded from create/update payloads?
- Does a new handler implement all required methods: `getType`, `calcChanges`, `processChanges`, `validate`?
- Does the `identifiers` array include `name` (or a stable name-like field) as the primary key — not solely an auto-generated UUID `id`?
- Is handler `@order()` placed correctly relative to its dependencies?
- Is the JSON schema complete and accurate without being so permissive it passes invalid configs?
- Is sorted-key output stable? No unintended order changes introduced in exported configs.

### 12. EA / Entitlement-Gated (apply if feature requires a flag or entitlement to test)

- Which scenarios could not be tested? Are they explicitly listed in the PR description?
- For each untested scenario, are the API assumptions spelled out — not buried under "code path confirmed correct"?
- If a field is read from `this.existing` (populated via list) and used in a guard: has the list endpoint been verified to return that field?
- If schema uses `additionalProperties: false` on an EA object: has the full read shape been confirmed from a real API response?
- Is there a follow-up ticket to re-verify untested scenarios once entitlement is available?

### Final Gate — answer all four before approving

1. If I export and immediately re-deploy with no changes, is anything mutated?
2. If a mid-operation step fails, is the system left in a recoverable state?
3. Has the safety contract been verified in code for every path — not just described in the PR?
4. Are docs and examples updated so another engineer can use this feature without reading the code?

### Lessons Learned

- **Safety claim ≠ safety in code.** "Deletes are gated" in a PR description doesn't mean the code gates deletes on every path. Verify line by line.
- **Early-exit logic is subtle.** `A && B` vs `A` in a guard clause can be the difference between a no-op and data loss.
- **Mocks can lie.** A test named "should not delete when flag is off" may pass for the wrong reason. Always verify the stub is called (or not called) with `sinon.assert`.
- **Export format drift breaks imports.** A richer export shape can silently break the import path if the importer doesn't handle it. Check both sides.
- **"Code path confirmed correct" ≠ tested end-to-end.** If an entitlement blocked a scenario, say so explicitly and enumerate the unverified assumptions.
