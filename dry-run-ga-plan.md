# Dry-Run GA — CI Non-Interactive Modes

## EA State

`--dry_run` is already implemented as EA. It:

- Shows a table of proposed changes (`CREATE` / `UPDATE` / `DELETE*`)
- Prompts an interactive menu: **Apply** / **Export to JSON** / **Exit**
- Is enabled via `AUTH0_DRY_RUN: true`, `--dry_run` CLI flag, or `AUTH0_DRY_RUN=true` env var

## GA Gap

Non-TTY environments (GitHub Actions, CI pipelines) cannot use the interactive menu. There is no way to:

- Use `--dry-run` in CI to **gate on drift** (fail the job if changes detected)
- Use `--dry-run` in CI to **deploy with visibility** (show plan, apply without prompting)

## Solution

`--dry-run` becomes **non-interactive by default** (CI-safe). Add `--interactive` flag to opt into the EA interactive menu. Add `preview-and-apply` mode for CI deployments.

---

## New Interface

### Mode table

| CLI                               | Behavior                                             | Exit code                                | Use case                           |
| --------------------------------- | ---------------------------------------------------- | ---------------------------------------- | ---------------------------------- |
| `--dry-run` / `--dry-run=preview` | Show table, exit (non-interactive)                   | `0` = no changes, `1` = changes detected | CI drift detection                 |
| `--dry-run --interactive`         | Show table, interactive menu (apply / export / exit) | `0` always                               | Manual deploy review (EA behavior) |
| `--dry-run=preview-and-apply`     | Show table, apply without prompting                  | `0` on success                           | CI deployment with visibility      |

> **Note:** `--dry-run=preview` is an explicit alias for bare `--dry-run`.
> **Note:** `-i` is already taken by `--input_file`, so `--interactive` has no short alias.

### CLI flags

```bash
# CI drift check — fails if changes detected (both equivalent)
a0deploy import -c config.json -i tenant.yaml --dry-run
a0deploy import -c config.json -i tenant.yaml --dry-run=preview

# Manual review — interactive menu (EA behavior)
a0deploy import -c config.json -i tenant.yaml --dry-run --interactive

# CI deployment with plan visibility — show plan, apply without prompting
a0deploy import -c config.json -i tenant.yaml --dry-run=preview-and-apply
```

### Node module (backward compat preserved)

```javascript
// EA: true maps to 'preview' (non-interactive, exits 1 if changes)
deploy({ config: { AUTH0_DRY_RUN: true } });

// GA: explicit modes
deploy({ config: { AUTH0_DRY_RUN: 'preview' } });
deploy({ config: { AUTH0_DRY_RUN: 'preview', AUTH0_DRY_RUN_INTERACTIVE: true } });
deploy({ config: { AUTH0_DRY_RUN: 'preview-and-apply' } });
```

---

## Implementation

### 1. `src/types.ts`

```typescript
// Change:
AUTH0_DRY_RUN?: boolean;

// To:
AUTH0_DRY_RUN?: boolean | 'preview' | 'preview-and-apply';
AUTH0_DRY_RUN_INTERACTIVE?: boolean;
AUTH0_VIEW_APPLY?: boolean;
```

### 2. `src/args.ts`

Change `dry_run` from boolean to string-with-choices. Add `interactive` flag:

```typescript
dry_run: {
  describe:
    'Dry-run mode. preview (default): show plan, exit — exit 1 if changes (CI drift check). preview-and-apply: show plan and apply without prompting (CI deployment).',
  type: 'string',
  choices: ['preview', 'preview-and-apply'],
},
interactive: {
  describe:
    'Use with --dry-run to enable the interactive menu (apply / export to file / exit). Not available in non-TTY environments.',
  type: 'boolean',
  default: false,
},
```

Update `SharedParams`:

```typescript
dry_run?: 'preview' | 'preview-and-apply';
interactive?: boolean;
```

### 3. `src/commands/import.ts`

```typescript
const { ..., dry_run: dryRun, interactive } = params;

// Normalize boolean true → 'preview' (EA compat)
const effectiveDryRun = dryRun === (true as any) ? 'preview' : dryRun;

if (effectiveDryRun) {
  overrides.AUTH0_DRY_RUN = effectiveDryRun;
  nconf.set('AUTH0_DRY_RUN', effectiveDryRun);
}
if (interactive) {
  overrides.AUTH0_DRY_RUN_INTERACTIVE = interactive;
  nconf.set('AUTH0_DRY_RUN_INTERACTIVE', interactive);
}
```

### 4. `src/tools/deploy.ts` — Mode dispatch

```typescript
const dryRunMode = config('AUTH0_DRY_RUN');
// Normalize boolean true → 'preview' (EA compat)
const effectiveMode = dryRunMode === true ? 'preview' : dryRunMode;
const isInteractive = config('AUTH0_DRY_RUN_INTERACTIVE');

if (effectiveMode === 'preview') {
  const hasChanges = await auth0.dryRun({ interactive: isInteractive });
  if (!isInteractive && hasChanges) {
    process.exit(1);
  }
  return auth0.handlers.reduce((accum, h) => {
    accum[h.type] = { deleted: 0, created: 0, updated: 0 };
    return accum;
  }, {});
}

if (effectiveMode === 'preview-and-apply') {
  nconf.set('AUTH0_VIEW_APPLY', true);
  // Falls through to processChanges() below
}
```

### 5. `src/tools/auth0/index.ts`

**`dryRun()` returns `boolean`, accepts options:**

```typescript
async dryRun(opts: { interactive?: boolean } = {}): Promise<boolean> {
  // ... table output logic (unchanged) ...
  if (opts.interactive && process.stdout.isTTY) {
    // show interactive menu: Apply / Export to JSON / Exit
  }
  return hasChanges;
}
```

**`processChanges()` skips prompt for `preview-and-apply`:**

```typescript
// Change TTY gate from:
if (process.stdout.isTTY) {
// To:
if (process.stdout.isTTY && !this.config('AUTH0_VIEW_APPLY')) {
```

### 6. `docs/using-dry-run.md` — Add CI/CD section

Add after the existing Usage section:

```markdown
## CI/CD Usage

By default, `--dry-run` is non-interactive and safe for CI pipelines.

### Drift Detection (PR Checks)

Exits code 1 if changes are detected, 0 if the tenant matches configuration:

\`\`\`bash
a0deploy import -c config.json -i tenant.yaml --dry-run
\`\`\`

GitHub Actions:
\`\`\`yaml

- name: Check for Auth0 drift
  run: a0deploy import -c config.json -i tenant.yaml --dry-run
  # Step fails if tenant has drifted from config
  \`\`\`

### Deployment with Visibility

Show the plan and apply without prompting:

\`\`\`bash
a0deploy import -c config.json -i tenant.yaml --dry-run=preview-and-apply
\`\`\`

### Interactive Repreview (Manual Deployments)

Add `--interactive` to get the EA-style menu (apply / export to file / exit):

\`\`\`bash
a0deploy import -c config.json -i tenant.yaml --dry-run --interactive
\`\`\`
```

---

## Critical files

| File                       | Change                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `src/types.ts`             | `AUTH0_DRY_RUN`: boolean → string union; add `AUTH0_DRY_RUN_INTERACTIVE`, `AUTH0_VIEW_APPLY` |
| `src/args.ts`              | `dry_run`: boolean → string choices; add `interactive` flag; update `SharedParams`           |
| `src/commands/import.ts`   | Normalize `true` → `'preview'`; set nconf for both flags                                     |
| `src/tools/deploy.ts`      | Multi-mode dispatch; normalize boolean; `preview` exits 1 if changes                         |
| `src/tools/auth0/index.ts` | `dryRun()` returns bool + accepts `interactive` opt; `processChanges` TTY gate               |
| `docs/using-dry-run.md`    | Add CI/CD usage section                                                                      |

---

## Verification

1. `npm run build` — zero TypeScript errors
2. `npm test` — no regressions
3. `AUTH0_DRY_RUN: true` (Node module) → non-interactive, exits 1 if changes (EA compat updated)
4. `--dry-run` with changes → `echo $?` → `1`
5. `--dry-run` no changes → `echo $?` → `0`
6. `--dry-run --interactive` in TTY → shows interactive menu
7. `--dry-run=preview-and-apply` in TTY → shows table, applies without prompt
