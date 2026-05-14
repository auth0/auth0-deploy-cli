# Auth0 Security Audit — Hackathon Plan

---

## What Are We Building?

A security audit platform on top of `auth0-deploy-cli`. Users export their Auth0 tenant config, run `a0deploy audit`, and get a prioritised list of real-world misconfigurations tied to named breaches. Optionally, Claude provides an AI-generated threat narrative and remediation plan.

---

## Branch Strategy

Work is split across two branches to keep scope clean and shippable independently.

| Branch | Scope |
|---|---|
| `hackathon` (this branch) | 3 new rules → 6 total new rules in demo, `--ai` flag on audit |
| `hackathon-ux` (new branch) | `a0deploy configure`, `a0deploy init-skill`, standalone public skill |

This way the audit + AI capability ships and demos even if the UX branch isn't finished.

---

## How the Full Flow Works

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPORT  (pulls live config from Auth0 — existing command)      │
│                                                                 │
│  a0deploy export -c config.json -f yaml -o ./export             │
│  → Node.js process reads credentials (Claude never sees them)   │
│  → All secrets replaced with ##PLACEHOLDER## tokens            │
│  → Output: exported YAML with only structural config            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  AUDIT  (scans exported config — this branch)                   │
│                                                                 │
│  a0deploy audit -i ./export                                     │
│  → 11 deterministic rules run, findings table printed           │
│  → Exit code 1 if any CRITICAL found (CI gating)                │
│                                                                 │
│  a0deploy audit --ai -i ./export          ← new in this branch  │
│  → Same deterministic table first                               │
│  → Claude adds: attack chains, threat narratives, top 3 fixes   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE SKILL  (hackathon-ux branch)                       │
│                                                                 │
│  a0deploy configure    ← one-time credential setup              │
│  a0deploy init-skill   ← writes skill into user's project       │
│  /audit-tenant         ← conversational AI audit in Claude Code │
└─────────────────────────────────────────────────────────────────┘
```

---

## Credential Boundary — What Claude Never Sees

```
config.json  /  env vars                   exported tenant.yaml
┌──────────────────────────┐              ┌──────────────────────┐
│ domain:    acme.auth0    │   a0deploy   │ clients:             │
│ client_id: abc123        │ ──export──►  │   name: "Acme SPA"   │
│ secret:    xyz789        │  (Node.js)   │   callbacks: [...]   │
└──────────────────────────┘              │   client_secret:     │
         ▲                                │     ##PLACEHOLDER##  │
  Claude never touches                    └──────────────────────┘
  credentials — only the                          ▲
  Node.js process reads them              Claude only sees this
```

Auth0's export replaces every credential with a `##KEYWORD##` token (see `src/context/defaults.ts`). The exported YAML is safe to analyze, diff, commit, and send to AI.

---

## What Exists Today

| Component | File | Status |
|---|---|---|
| Rule engine | `src/tools/audit/index.ts` | ✅ Done |
| 8 security rules | `src/tools/audit/rules/*.ts` | ✅ Done |
| `audit` CLI command | `src/commands/audit.ts` | ✅ Done |
| Args + entrypoint | `src/args.ts`, `src/index.ts` | ✅ Done |
| Finding + Severity types | `src/tools/audit/types.ts` | ✅ Done |
| Demo YAML (8 rules) | `examples/demo-misconfigured-tenant.yaml` | ✅ Done (needs update to 11 findings) |

### Existing 16 Rule Checks (across 8 rule files)

| Rule ID | Severity | What it catches |
|---|---|---|
| `callback-wildcard` | CRITICAL | `*` in callbacks — open redirect |
| `mfa-disabled` | CRITICAL | MFA explicitly off |
| `refresh-token-misconfiguration` | CRITICAL / HIGH | Non-expiring + non-rotating refresh tokens |
| `brute-force-protection-disabled` | CRITICAL | Brute force protection off entirely |
| `non-m2m-management-api-grant` | CRITICAL | SPA/native app with Management API grant |
| `callback-http` | HIGH | Non-HTTPS callback URL |
| `logout-url-wildcard` | HIGH | `*` in logout URLs |
| `origin-wildcard` | HIGH | `*` in allowed_origins — CORS bypass |
| `brute-force-protection-no-block` | HIGH | Protection on but no `block` shield |
| `suspicious-ip-throttling-disabled` | HIGH | IP throttling disabled |
| `password-policy-contradiction` | HIGH | Policy level contradicts complexity settings |
| `overly-broad-client-grant` | HIGH | Sensitive Management API scopes granted |
| `allow-all-scopes` | HIGH | `allow_all_scopes: true` on a grant |
| `token-lifetime-too-long` | MEDIUM | access_token > 24h or session > 72h |
| `bot-detection-off` | MEDIUM | Bot detection level is `none` |
| `captcha-no-active-provider` | MEDIUM | CAPTCHA configured but no active provider |

---

## Branch 1: `hackathon` — Development Tasks

### Task 1A — Three New Breach-Tied Rules

Three new files in `src/tools/audit/rules/`. After writing, add all three imports to `src/tools/audit/index.ts`.

#### Rule 1: `riskAssessmentDisabled.ts`

> **0ktapus (2022)** — One SMS phishing kit hit 130+ companies: Twilio, Cloudflare, DoorDash, Signal. Attackers stole live OTP codes + session tokens in real time and replayed them in seconds. Auth0 risk assessment (impossible travel, new device detection, velocity anomalies) would have re-challenged every replayed session before it could be used.

| Check | Severity |
|---|---|
| `riskAssessment.settings.enabled === false` | HIGH |

#### Rule 2: `logStreamsEmpty.ts`

> **Okta Support System (Oct 2023)** — Attackers accessed customer tenant data for weeks with zero detection. Customers without log streaming to a SIEM had no real-time visibility. The breach was found by a customer reviewing their own logs — not by Okta.

| Check | Severity |
|---|---|
| `!assets.logStreams \|\| assets.logStreams.length === 0` | MEDIUM |

#### Rule 3: `guardianPolicyNotTenantWide.ts`

> **Scattered Spider / MGM Resorts (Sep 2023, ~$100M loss)** — Group targeted orgs where individual apps could opt out of MFA. Without `all-applications` in the Guardian policy, one misconfigured app is all an attacker needs.

| Check | Severity |
|---|---|
| `guardianPolicies.policies` does not include `'all-applications'` | HIGH |

---

### Task 1B — Two Additional Rules (reach 11 new checks total in demo)

These two rules add real-world depth without breach stories — they are widely accepted security baselines.

#### Rule 4: `legacyGrantTypes.ts`

ROPC and implicit flow are both deprecated and removed in OAuth 2.1. ROPC sends passwords directly to the app bypassing MFA; implicit leaks tokens in URL fragments via Referer headers and browser history.

| Check | Severity |
|---|---|
| `tenant.flags.allow_legacy_ro_grant_types === true` | HIGH |
| Any `client.grant_types` includes `'implicit'` | HIGH |

#### Rule 5: `breachedPasswordDetection.ts`

Auth0 checks credentials against known breach databases (HaveIBeenPwned). When disabled, credentials from any past breach — RockYou2021, LinkedIn 2016, hundreds of others — work silently with no friction, no alert, no block.

| Check | Severity |
|---|---|
| `attackProtection.breachedPasswordDetection.enabled === false` | HIGH |

---

### Updated Demo Findings After All 5 New Rules

Update `examples/demo-misconfigured-tenant.yaml` to trigger **11 findings — 3 critical, 6 high, 2 medium**.

| # | Sev | Rule | Misconfiguration | Story |
|---|---|---|---|---|
| 1 | CRITICAL | `refresh-token-misconfiguration` | SPA: non-expiring + non-rotating refresh token | Stolen token = permanent silent access |
| 2 | CRITICAL | `mfa-disabled` | `mfa.active: false` on auth connection | One leaked password = full account takeover |
| 3 | CRITICAL | `non-m2m-management-api-grant` | SPA holds a Management API grant | Any user can call admin endpoints |
| 4 | HIGH | `callback-wildcard` | Callback `https://*.acme.com/callback` | Auth code stolen via subdomain takeover |
| 5 | HIGH | `guardian-policy-not-tenant-wide` | Guardian policy is `selected-applications` | **Scattered Spider / MGM (2023, ~$100M)** |
| 6 | HIGH | `risk-assessment-disabled` | `riskAssessment.settings.enabled: false` | **0ktapus (2022, 130+ companies)** |
| 7 | HIGH | `brute-force-protection-no-block` | Brute force on, `block` shield missing | Attacks logged, never stopped |
| 8 | HIGH | `legacy-grant-ropc` | `allow_legacy_ro_grant_types: true` | ROPC bypasses MFA entirely |
| 9 | HIGH | `breached-password-detection-disabled` | `breachedPasswordDetection.enabled: false` | HaveIBeenPwned credentials work silently |
| 10 | MEDIUM | `log-streams-empty` | No log streams configured | **Okta breach (2023) — weeks undetected** |
| 11 | MEDIUM | `token-lifetime-too-long` | `access_token_lifetime: 172800` (48h) | Stolen token valid 2 full days |

Target output: **`Found 11 issue(s): 3 critical  6 high  2 medium`**

---

### Task 2 — `audit --ai` Flag

**Merge `ai-audit` into the existing `audit` command as an optional `--ai` flag.** One command, cleaner UX.

```bash
a0deploy audit -i ./export               # deterministic only, no API key needed
a0deploy audit --ai -i ./export          # deterministic + Claude narrative
```

**Files:**

| File | Change |
|---|---|
| `src/commands/loadAssets.ts` | **Create** — extract `loadAssets()` out of `audit.ts` into shared util |
| `src/commands/audit.ts` | **Modify** — add `--ai` handling, import `loadAssets` from shared util |
| `src/args.ts` | **Modify** — add `--ai` boolean flag to audit command definition |

**Logic when `--ai` is set:**
1. Print the deterministic findings table as normal
2. If no findings — exit, no AI call needed
3. Check `ANTHROPIC_API_KEY` in env — if absent, print one-line warning and return cleanly
4. Build redacted config excerpt: take `clients`, `connections`, `attackProtection`, `tenant.flags`, `guardianPolicies`, `riskAssessment` from assets; replace any string matching `##.*##` or known secret field names (`client_secret`, `secret`, `auth_token`, `smtp_pass`) with `"[REDACTED]"`
5. Call `claude-sonnet-4-6` with:
   - **System:** `"You are a security expert reviewing Auth0 identity infrastructure. Be concise and direct."`
   - **User:** findings JSON + redacted config — ask Claude to: group findings into attack chains, write a 2-sentence threat narrative per finding, name top 3 to fix first with justification, note any additional risks in the config the rules didn't catch
6. Stream response to stdout below the findings table

---

### Branch 1 — Files to Create / Modify

| File | Action |
|---|---|
| `src/tools/audit/rules/riskAssessmentDisabled.ts` | Create |
| `src/tools/audit/rules/logStreamsEmpty.ts` | Create |
| `src/tools/audit/rules/guardianPolicyNotTenantWide.ts` | Create |
| `src/tools/audit/rules/legacyGrantTypes.ts` | Create |
| `src/tools/audit/rules/breachedPasswordDetection.ts` | Create |
| `src/tools/audit/index.ts` | Modify — wire 5 new rules |
| `src/commands/loadAssets.ts` | Create — shared util |
| `src/commands/audit.ts` | Modify — `--ai` flag + import `loadAssets` |
| `src/args.ts` | Modify — `--ai` boolean on audit |
| `examples/demo-misconfigured-tenant.yaml` | Modify — add 2 new misconfigs to reach 11 findings |

---

## Branch 2: `hackathon-ux` — Development Tasks

### Task 3 — `a0deploy configure`

**Does not exist today.** New command for first-time users and non-engineers.

**File:** `src/commands/configure.ts`

**What it does:**
1. Prompts for `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` (hidden input)
2. Writes to `~/.config/auth0-deploy-cli/credentials.json`
3. Prints setup instructions for a read-only M2M app (which scopes to grant)

**Update `src/commands/export.ts` and `src/commands/import.ts`:** add fallback to read from `~/.config/auth0-deploy-cli/credentials.json` when no `-c` flag and no env vars are present.

**Dependency:** `@clack/prompts` — already in `package.json`.

**Credential priority after this change:**
1. `-c config.json` flag (explicit, highest priority)
2. `AUTH0_DOMAIN` + `AUTH0_CLIENT_ID` + `AUTH0_CLIENT_SECRET` env vars
3. `~/.config/auth0-deploy-cli/credentials.json` (written by `configure`)

> **Why not `AUTH0_ACCESS_TOKEN`?** The Auth0 Dashboard API Explorer token carries every Management API scope — full admin read and write. If it leaks, the entire tenant is exposed. The read-only M2M app used by `configure` grants only `read:*` scopes, so a leaked token cannot change or delete anything.

---

### Task 4 — `a0deploy init-skill`

**File:** `src/commands/initSkill.ts`

Writes `.claude/skills/audit-tenant.md` into the current working directory. This is the distribution mechanism — it plants the skill inside the user's own Auth0 config repo so `/audit-tenant` is available when they open that project in Claude Code.

**Why a command and not just a file in this repo:**
`auth0-deploy-cli` is a global npm package. End users run it from their own repos, not this one. A skill committed here would be invisible to them. `init-skill` solves this by writing the skill file into their project on demand.

**What the written skill does when `/audit-tenant` is invoked:**

1. Detects credentials automatically — checks `config.json` in CWD → env vars → `~/.config/auth0-deploy-cli/credentials.json`
2. Explicitly warns: *"Do NOT paste credentials or config.json contents in chat. Give me only a file path."*
3. Runs export + audit via `a0deploy` on PATH:
   ```bash
   a0deploy export -f yaml -o /tmp/a0audit
   a0deploy audit -i /tmp/a0audit
   ```
4. Provides AI analysis: attack chain groupings, threat narratives, top 3 priorities
5. Offers follow-ups: *"Generate a fixed version of this config"* / *"Open a PR with remediation changes"*

---

### Task 5 — Standalone Public Skill (no deploy-cli required)

A separate skill that works for anyone with an Auth0 tenant — no CLI install, no npm, just a domain and a read-only token.

**How it works:**
Instead of calling `a0deploy export`, the skill fetches config directly from the Management API via `curl`:

```bash
curl -s -H "Authorization: Bearer $AUTH0_ACCESS_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/clients?fields=name,app_type,callbacks,grant_types,refresh_token,access_token_lifetime" \
  > /tmp/clients.json
# repeat for connections, attackProtection, tenant, guardianPolicies, riskAssessment, logStreams
```

Claude then reads those files and applies the same analysis.

**Critical safety requirement before shipping:**
The Management API returns some fields that contain real secrets (`client_secret` on connections, tokens in log stream sinks, etc.). The skill must explicitly request only the fields needed for auditing via the `fields` query param on each endpoint, and must strip any remaining credential-looking values before Claude reads them. The deploy-cli approach is safer because `src/context/defaults.ts` already handles this masking — the standalone skill needs equivalent logic.

**Where it lives:**
A separate public repo (e.g. `auth0/audit-skill`) containing only a `CLAUDE.md` and the skill file. Anyone can clone it, run `a0deploy init-skill` equivalent (just copy the file), and use it immediately.

**This is a post-hackathon item** — needs its own secret-stripping logic and field filtering before it is safe to ship publicly. For the demo, the deploy-cli skill is sufficient.

---

### Branch 2 — Files to Create / Modify

| File | Action |
|---|---|
| `src/commands/configure.ts` | Create |
| `src/commands/export.ts` | Modify — credentials fallback |
| `src/commands/import.ts` | Modify — credentials fallback |
| `src/commands/initSkill.ts` | Create |
| `src/args.ts` | Modify — register `configure`, `init-skill` |
| `src/index.ts` | Modify — wire `configure`, `init-skill` handlers |

---

## Post-Hackathon Roadmap

| Item | Notes |
|---|---|
| Standalone public skill (no deploy-cli) | Needs field-level secret filtering on direct API calls before safe to ship |
| `@auth0/security-rules` npm package | Extract rules when a GitHub Action or VS Code extension needs them independently |
| `a0deploy audit --fix` | AI-generated remediated YAML output; conversational fix via skill covers this for now |
| `a0deploy export --audit` | Single command combining export + audit |

---

## Verification Checklist

```bash
# ── Branch 1 ──────────────────────────────────────────────────

# Build
npm run build

# 11 findings on demo YAML
node dist/index.js audit -i examples/demo-misconfigured-tenant.yaml
# Expected: Found 11 issue(s): 3 critical  6 high  2 medium

# Clean config — no findings
node dist/index.js audit -i examples/directory
# Expected: No security issues found

# AI flag with key
ANTHROPIC_API_KEY=<key> node dist/index.js audit --ai -i examples/demo-misconfigured-tenant.yaml
# Expected: findings table + Claude narrative streamed below

# AI flag without key — graceful fallback
node dist/index.js audit --ai -i examples/demo-misconfigured-tenant.yaml
# Expected: one-line warning, plain audit runs normally

# ── Branch 2 ──────────────────────────────────────────────────

# configure saves credentials
node dist/index.js configure
# Expected: prompts for domain/client_id/secret, saves to ~/.config/...

# export uses saved credentials (no -c flag)
node dist/index.js export -f yaml -o /tmp/test-export
# Expected: works without config.json if credentials were saved

# init-skill creates the file
node dist/index.js init-skill
# Expected: .claude/skills/audit-tenant.md written to CWD

# skill is available in Claude Code
# Open any project containing .claude/skills/audit-tenant.md
# Type /audit-tenant — skill should appear and execute
```
