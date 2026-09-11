# PR Review Guide

A checklist for reviewing pull requests thoroughly. Go through every section — not just the ones that seem obviously relevant.

> **This is a living document.** Add a new section, checklist item, or lesson learned whenever a real review surfaces a pattern worth capturing — especially bugs that slipped through, assumptions that proved wrong, or deploy-cli-specific gotchas not covered yet. The goal is that every hard-won insight ends up here so it doesn't have to be rediscovered.

---

## 1. Context & Purpose

- [ ] Is the PR description clear? Does it explain **why** this change is needed, not just what it does?
- [ ] Is there a linked issue? Does the PR actually close it?
- [ ] Is the scope reasonable — does it do one thing, or is it trying to do too many things?

---

## 2. Correctness

- [ ] Does the logic do what the description claims?
- [ ] Are there off-by-one errors, wrong conditions, or inverted checks?
- [ ] Are early exits and guard clauses correct? Do they cover all the right cases — not too broad, not too narrow?
- [ ] Are error paths handled? Does a failure in one step leave state inconsistent?
- [ ] Are there any silent failures (swallowed errors, empty catch blocks)?
- [ ] Does the ordering of operations matter? Is it correct? (e.g., create before delete, update references before deleting dependencies)

---

## 3. Edge Cases

- [ ] What happens with empty input / empty arrays / null / undefined?
- [ ] What happens when the resource already exists (idempotency)?
- [ ] What happens when a partial failure occurs mid-operation?
- [ ] What happens at scale (large tenants, many resources)?
- [ ] Are there race conditions or ordering dependencies across handlers/services?

---

## 4. Backward Compatibility

- [ ] Does this break any existing config formats or file structures?
- [ ] Will existing users' workflows (export → deploy) still work without changes?
- [ ] If behavior changed, is it gated behind a flag or opt-in?
- [ ] Are old config shapes (from before this PR) still handled gracefully?
- [ ] Does any new export format, when re-deployed unchanged, produce unintended side effects (e.g., unexpected deletes)?

---

## 5. Safety & Destructive Operations

- [ ] Are destructive operations (delete, overwrite) properly gated (e.g., `ALLOW_DELETE` flag)?
- [ ] Is the stated safety contract actually enforced in code — for **all** paths, not just the obvious ones?
- [ ] Are there any scenarios where a no-op deploy (nothing changed) could still cause mutations?

---

## 6. Tests

- [ ] Are unit tests present for new logic?
- [ ] Do the tests actually test what their names claim? (Check mocks — are they realistic?)
- [ ] Are the critical/risky paths covered (not just the happy path)?
- [ ] Are E2E tests present or updated for new features? If not, is there a clear reason?
- [ ] Is there a test for the **exact** failure scenario the PR is fixing (regression test)?
- [ ] Are there tests for idempotency — running the same operation twice produces no extra changes?

---

## 7. Docs & Examples

- [ ] Is there a new config shape or new feature? If yes — are examples updated?
- [ ] Are example files (e.g., `examples/`, `tenant.yaml`) updated to demonstrate the new functionality?
- [ ] Is the README or any relevant documentation updated?
- [ ] Are new config fields, env vars, or flags documented?

---

## 8. Code Quality

- [ ] Is the code readable and does it follow existing patterns in the codebase?
- [ ] Are there unnecessary type casts (`as any`, `as Function`) that bypass type safety?
- [ ] Is there dead code, unused imports, or leftover debug statements?
- [ ] Are there magic strings/numbers that should be constants?
- [ ] Is mutation of shared state (e.g., assets objects) clearly intentional and safe?

---

## 9. Performance

- [ ] Are there N+1 query patterns (API calls inside loops)?
- [ ] Are expensive operations (fetching all resources) only triggered when necessary?
- [ ] Could this cause rate limiting for large tenants?

---

## 10. Security

- [ ] Are sensitive values (secrets, PEM keys, tokens) ever logged or exported?
- [ ] Is user-controlled input validated before use?
- [ ] Are there injection risks (command, SQL, etc.)?

---

## 11. CI

- [ ] Do all CI checks pass (lint, type check, unit tests, E2E)?
- [ ] Are there any flaky or skipped tests that mask real issues?

---

## Final Sign-off Questions

Before approving, ask:

1. **If I export and immediately re-deploy with no changes, is anything mutated?**
2. **If a mid-operation step fails, is the system left in a recoverable state?**
3. **Has the stated safety contract been verified in code for every path — not just described in the PR?**
4. **Are docs and examples updated so another engineer can use this feature without reading the code?**

---

## 12. deploy-cli Specific Checks

- [ ] Does the change work in **both** YAML and directory formats? (If it touches a handler or context parser, both paths must be verified.)
- [ ] Is the **dry-run path** correct? A dry-run should never mutate state — check that the change respects the dry-run flag on all affected paths.
- [ ] Is **keyword replacement** (`@@KEY@@` for JSON-stringified, `##KEY##` for literal) preserved correctly? New fields that may contain keywords must pass through replacement; fields stripped on export must not lose replacement on re-import.
- [ ] Are **write-only fields** (e.g. `value`, secrets, key material) correctly stripped on export and never written to disk?
- [ ] Are **read-only/API-generated fields** (e.g. `created_at`, `updated_at`, `fingerprint`, `id`) stripped on export and excluded from create/update payloads (`stripCreateFields` / `stripUpdateFields`)?
- [ ] Does a new handler implement **all required methods**: `getType`, `calcChanges`, `processChanges`, `validate`? Are they consistent with the `DefaultAPIHandler` pattern? (Note: `dump` is on `YAMLContext`/`DirectoryContext`, not on handlers.)
- [ ] Is the **identifier** (`identifiers` array) correct? The array must include `name` (or a stable name-like field) as the primary matching key — do not rely solely on an auto-generated UUID `id`, as these do not survive cross-tenant and export→import roundtrips.
- [ ] Does the **ordering** (`@order()`) place this handler correctly relative to handlers it depends on or that depend on it?
- [ ] Is the **JSON schema** (`schema`) complete and accurate? Does it allow all valid API shapes without being so permissive it passes invalid configs?

---

## 13. Entitlement-gated / EA features — partially untestable scenarios

- [ ] Which scenarios require a feature flag or special entitlement to test end-to-end? List them explicitly in the PR description.
- [ ] For each scenario that _could not_ be tested, what specific API behavior is being assumed? (e.g., "list endpoint returns this field", "read shape matches write shape", "PATCH accepts this field on an existing resource") These assumptions must be called out — not buried under "code path confirmed correct."
- [ ] If a field is read back from `this.existing` (populated via `list`) and used in a guard or condition, has the list endpoint been verified to actually return that field for an entitled tenant? List and single-GET responses are often not symmetric, especially for EA features.
- [ ] If the schema uses `additionalProperties: false` on an EA feature's object, has the full read shape been confirmed from a real API response? If not, relax the constraint until the shape is finalized at GA.
- [ ] Is there a follow-up task/ticket to re-verify untested scenarios once entitlement is available?

---

## Lessons Learned (from real reviews)

- A safety claim in the PR description is not the same as the safety being enforced in code — verify it line by line.
- Check early-exit conditions carefully: `A && B` vs `A` can be the difference between a no-op and data loss.
- Test names can lie — always check that the mock matches what the test name calls.
- New export formats that add metadata to previously bare stubs can silently break the deploy path if not accounted for.
- E2E tests and example updates are non-negotiable for user-facing features.
- "Code path confirmed correct" is not the same as "tested end-to-end" — if an entitlement or flag blocked a scenario, say so explicitly and list the unverified assumptions.
