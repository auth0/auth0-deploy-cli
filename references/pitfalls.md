# Common Pitfalls — auth0-deploy-cli

## 1. Dry-run must never mutate

`processChanges()` is called in both live and dry-run mode. The dry-run guard lives higher up the call stack — any code path that bypasses it (e.g. a direct API call outside `processChanges`) silently mutates tenant state. Always verify the full call graph, not just the handler method.

## 2. Both YAML and directory formats must work

New fields, handlers, and schema changes must work in both context formats. The YAML context uses a single `tenant.yaml`; the directory context uses nested JSON files. Test with both. Failing one format is a silent breakage users hit in production.

## 3. @@KEY@@ vs ##KEY## — use the right pattern

- `@@KEY@@` — JSON-stringified. Use for arrays, objects, booleans, numbers. If the replacement is a JSON array, `@@KEY@@` produces valid YAML/JSON inline.
- `##KEY##` — literal string substitution. Use only for plain string values.

Mixing them up causes silent corruption: a `##KEY##` wrapping a JSON array produces invalid YAML.

## 4. "Code path confirmed correct" ≠ "tested end-to-end"

For EA / entitlement-gated features, code review cannot substitute for a real API call. The API may return fields the code doesn't expect, or omit fields the code reads from `this.existing`. Always document what you could not test and create a follow-up ticket.

## 5. additionalProperties: false on EA objects

If a schema uses `additionalProperties: false` and the API later returns a new field on that object, every deploy will fail schema validation. Only use `additionalProperties: false` after confirming the exact API response shape from a real tenant response — not API docs alone.

## 6. identifiers must include name

`identifiers = ['id']` uses the auto-generated API ID for cross-tenant matching. This breaks portability — the ID is tenant-specific. Always include `name` (or a stable name-like field) as the primary matching key.

## 7. Export → re-deploy roundtrip must be idempotent

After an export, re-deploying the same config with no manual changes must produce zero diffs. Any field that gets transformed on export and then looks different on the next import/export cycle is a bug. Test this explicitly for new fields.

## 8. @order() placement

Handlers run in dependency order defined by `@order()`. A handler that creates resources another depends on (e.g. Connections before Clients) must have a lower order number. Wrong order → 404s or constraint errors during deploy.

---

## Debugging

### Enable verbose logging

```bash
AUTH0_DEBUG=true node lib/index.js import -c config.json -i ./local/tenant.json
```

### Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build errors / import not found | `tsconfig.json` path mismatch | Check `tsconfig.json` and ensure all imports resolve |
| "Handler not found" / resource skipped silently | Resource type not registered | Verify it's added to `src/tools/constants.ts` |
| Schema validation fails on deploy | Schema too strict or missing fields | Check schema definition in the handler file; confirm against a real API response |
| Keyword replacement produces raw `@@KEY@@` in output | Mapping missing or wrong pattern | Verify `AUTH0_KEYWORD_REPLACE_MAPPINGS` config and confirm `@@KEY@@` vs `##KEY##` |
| E2E fails with auth errors | Missing or wrong credentials | Check `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` |

### Key files for debugging

- `src/tools/deploy.ts` — deployment orchestration; check here first if a resource is silently skipped
- `src/tools/calculateChanges.ts` — change detection; check here for unexpected create/update/delete
- `test/utils.js` — `mockPagedData()` and other test helpers
