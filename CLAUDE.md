# CLAUDE.md — How to Work in This Repo

For codebase structure, setup commands, and architecture: see [AGENTS.md](./AGENTS.md).
This file governs **how to behave** when developing or reviewing in this repo.

---

## Quick Reference — Which Section to Use

| What you are doing                            | Go to                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| Implementing a feature, handler, or API spec  | [Feature Development Protocol](#feature-development-protocol) |
| About to call your work done                  | [Pre-Submit Gate](#pre-submit-gate)                           |
| Working on an EA / feature-flag-gated feature | [EA Feature Rules](#ea--entitlement-gated-feature-rules)      |
| Reviewing a PR                                | [PR Review Protocol](#pr-review-protocol)                     |

---

## Feature Development Protocol

Follow these steps **in order** when implementing any new feature, handler, or API spec.

### Step 1 — Understand Before Writing

- Read the existing handler closest to what you're building. Match its patterns exactly.
- Check `src/tools/auth0/handlers/` — does a handler for this resource already exist?
- Check `src/tools/constants.ts` — is the resource type registered?
- Identify whether this change touches the YAML context, directory context, or both.

### Step 2 — Answer These Before Writing Any Code

1. What is the **stable identifier** for this resource? `name` (or equivalent stable name field) must be in the `identifiers` array — do not rely solely on an auto-generated UUID `id` for cross-tenant matching.
2. Which fields are **write-only** (secrets, key material, `value`)? → must be stripped on export, never written to disk.
3. Which fields are **read-only / API-generated** (`created_at`, `updated_at`, `id`, `fingerprint`)? → must be stripped on export and excluded from create/update payloads.
4. Does this resource have **ordering dependencies** on other handlers? → set `@order()` correctly.
5. Do any fields potentially contain **keywords** (`@@KEY@@` / `##KEY##`)? → must pass through replacement.

### Step 3 — Implement All Four Required Handler Methods

No exceptions. Every handler must have:

| Method             | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `getType()`        | Fetch current state from Auth0 API                     |
| `calcChanges()`    | Determine which resources to create, update, or delete |
| `processChanges()` | Execute CRUD operations against the API                |
| `validate()`       | Validate assets before processing; base class provides a default, override if needed |

> Note: export formatting (`dump`) is handled by `YAMLContext` and `DirectoryContext`, not by handlers.

Follow the `DefaultAPIHandler` pattern. Read `src/tools/auth0/handlers/clients.ts` as the reference implementation if unsure.

### Step 4 — Write Tests Alongside the Code

For every handler or feature:

- **Unit test — happy path**: normal create, update, delete
- **Unit test — error path**: what happens when the API call fails
- **Unit test — empty input**: empty arrays, null, undefined inputs
- **Unit test — idempotency**: running the same operation twice produces no extra changes
- **Regression test**: if fixing a bug, write a test that would have caught the original bug
- **E2E test**: required for any user-facing feature; "no E2E" must have an explicit documented reason in the PR

> **Verify mocks are realistic.** Test names can claim one thing while a mock silently tests something else. Always confirm the mock shape matches what the real API returns.

### Step 5 — Verify Both Formats

If the change touches a handler or context parser, test (or manually verify) both:

- YAML format (`tenant.yaml` single-file)
- Directory format (nested JSON files)

Both paths must work. Verifying only one is not sufficient.

---

## Pre-Submit Gate

Before calling any work complete, answer all four questions. If any answer is "no" or "unsure", fix it first — do not submit.

1. **Idempotency**: If I export and immediately re-deploy with no changes, is anything mutated?
2. **Partial failure**: If a mid-operation step fails, is the system left in a recoverable state?
3. **Safety contract in code**: Is every safety claim (e.g. `ALLOW_DELETE` gating) enforced in code on every affected path — not just described in a comment or PR description?
4. **Docs and examples**: Are examples updated so another engineer can use this feature without reading the source code?

Also run locally before submitting:

```bash
npm run build
npm test
npm run lint
```

---

## deploy-cli Invariants

These rules apply to **every change** that touches a handler or context parser. They are not optional review items — treat them as constraints.

| Invariant                         | What to verify                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Both formats work**             | YAML and directory paths both produce correct behavior                                                             |
| **Dry-run is non-mutating**       | `isDryRun` flag is respected on every affected code path                                                           |
| **Keyword replacement preserved** | New fields that may contain keywords pass through `@@KEY@@` (JSON-stringified) and `##KEY##` (literal) replacement |
| **Write-only fields stripped**    | Secrets, `value`, key material are never written to disk during export                                             |
| **Read-only fields excluded**     | `created_at`, `updated_at`, `id`, `fingerprint` are stripped on export and excluded from create/update payloads    |
| **Match by name, not auto-id**    | `identifiers` array must include `name` (or a stable name-like field) as the primary matching key — never rely solely on an auto-generated UUID `id` for cross-tenant roundtrips |
| **Handler ordering correct**      | `@order()` places this handler correctly relative to handlers it depends on or that depend on it                   |
| **Schema is complete**            | JSON schema allows all valid API shapes without being so permissive it passes invalid configs                      |

---

## PR Review Protocol

Read and follow [PR_REVIEW_GUIDE.md](./PR_REVIEW_GUIDE.md) in full, every section, in order. Do not skip sections because they seem irrelevant.

Focus extra attention on these — highest rate of missed issues:

- **Section 12 (deploy-cli Specific)** — most frequently skipped; verify all 9 items
- **Section 5 (Safety)** — verify the safety contract is enforced in code, not just stated in the PR
- **Section 4 (Backward Compatibility)** — export → deploy roundtrips break silently
- **Section 13 (EA / Entitlement-gated)** — apply whenever a feature requires a flag or entitlement to test
- **Section 6 (Tests)** — verify mocks are realistic, not just that tests exist

Use the **Final Gate questions** at the bottom of PR_REVIEW_GUIDE.md as the last check before approving. All four must be answerable with "yes."

---

## EA / Entitlement-Gated Feature Rules

Apply this section when any part of a feature requires a feature flag or special entitlement to test end-to-end.

### During Development

- In the PR description, explicitly list which code paths could **not** be exercised and why.
- For each untested path, state the exact API assumption being made. Examples:
  - _"The list endpoint returns field X for entitled tenants — not verified."_
  - _"The read shape matches the write shape for this resource — assumed, not confirmed."_
  - _"PATCH accepts this field on an existing resource — assumed from API docs."_
- **Never write "code path confirmed correct"** without specifying what was actually run against a real tenant.
- If reading a field from `this.existing` (populated via the list endpoint) inside a guard or condition: explicitly verify that the list endpoint returns that field for entitled tenants. List and single-GET responses are often **not symmetric** for EA features.
- If using `additionalProperties: false` in a schema for an EA resource object: confirm the full read shape from a real API response. If not confirmed, relax the constraint (`additionalProperties: true`) until GA, and document why.
- Create a follow-up ticket to re-verify all untested scenarios once entitlement is available. Link it in the PR.

### During Review

- "Code path confirmed correct" is not the same as "tested end-to-end." Ask the author to enumerate their unverified assumptions explicitly.
- Check whether `additionalProperties: false` constraints on EA objects are premature given that the read shape hasn't been confirmed.
- Verify that a follow-up ticket exists for every scenario that was skipped due to entitlement.

---

## Traps — From Real Bugs in This Codebase

These are the highest-signal patterns. Each one has caused a real bug.

- **Safety claim ≠ safety in code.** A PR description that says "deletes are gated" does not mean the code gates deletes on every path. Verify line by line.
- **Early-exit logic is subtle.** `A && B` vs `A` in a guard clause can be the difference between a no-op and data loss. Read conditions carefully and check what happens when the condition is false.
- **Mocks can lie.** A test named "should not delete when flag is off" may be passing for the wrong reason. Always verify the mock shape matches actual API behavior.
- **Export format drift breaks imports.** New export formats that enrich previously bare stubs can silently break the deploy (import) path if the importer doesn't handle the richer shape. Always check both sides.
- **E2E and examples are not optional.** For any user-facing feature, E2E test coverage and updated example files are required — not "nice to have."
- **"Confirmed correct" is not "tested."** If an entitlement or flag blocked a scenario, say so explicitly and enumerate the unverified assumptions. Do not imply the scenario was validated when it was not.
