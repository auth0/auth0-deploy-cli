#!/usr/bin/env bash
#
# Manual real-world verification for the phone-templates create-on-import fix.
#
# Reproduces the customer's scenario against a REAL, freshly created tenant:
#   export -> edit a template -> import -> re-export -> assert the edit landed.
#
# Prereqs:
#   1. Create a BRAND NEW Auth0 tenant. Do not touch its phone templates.
#   2. Create an M2M app authorized for the Management API with (at least)
#      read/create/update on branding phone templates.
#   3. npm run build   (this script runs the compiled lib, i.e. the real CLI)
#
# Usage:
#   AUTH0_DOMAIN=xxx.auth0.com \
#   AUTH0_CLIENT_ID=xxx \
#   AUTH0_CLIENT_SECRET=xxx \
#   ./scripts/verify-phone-templates-fix.sh
#
set -euo pipefail

: "${AUTH0_DOMAIN:?set AUTH0_DOMAIN}"
: "${AUTH0_CLIENT_ID:?set AUTH0_CLIENT_ID}"
: "${AUTH0_CLIENT_SECRET:?set AUTH0_CLIENT_SECRET}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="node $ROOT/lib/index.js"
WORK="$(mktemp -d)"
CONFIG="$WORK/config.json"
SENTINEL="DEPLOY_CLI_VERIFY_$(date +%s)"

cat > "$CONFIG" <<EOF
{
  "AUTH0_DOMAIN": "$AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID": "$AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET": "$AUTH0_CLIENT_SECRET"
}
EOF

echo "==> Work dir: $WORK"
echo "==> Sentinel text: $SENTINEL"

echo "==> 1/4 Initial export"
$CLI export --format=yaml --output_folder="$WORK/out" --config_file="$CONFIG"

TENANT_YAML="$WORK/out/tenant.yaml"
if ! grep -q "phoneTemplates" "$TENANT_YAML"; then
  echo "!! No phoneTemplates found in export. Does this tenant have the Unified Phone Experience enabled?"
  exit 1
fi

echo "==> 2/4 Inject sentinel into the first phone template body text"
# Insert the sentinel into the first 'text:' line under phoneTemplates.
python3 - "$TENANT_YAML" "$SENTINEL" <<'PY'
import sys, re
path, sentinel = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines(keepends=True)
in_pt = False
done = False
out = []
for ln in lines:
    if re.match(r'^phoneTemplates:', ln):
        in_pt = True
    elif re.match(r'^\S', ln):  # next top-level key
        in_pt = False
    if in_pt and not done and re.search(r'\btext:\s*', ln):
        ln = re.sub(r'(text:\s*["\']?)', r'\g<1>' + sentinel + ' ', ln, count=1)
        done = True
    out.append(ln)
open(path, 'w').write(''.join(out))
assert done, "Could not find a text: line under phoneTemplates to edit"
print("   edited:", path)
PY

echo "==> 3/4 Import edited config (this exercises the create-on-import fix)"
# --debug so the 'Created' / 'falling back to update' lines are visible.
AUTH0_DEBUG=true $CLI import --config_file="$CONFIG" --input_file "$TENANT_YAML" 2>&1 | tee "$WORK/import.log"

echo "==> Checking import log for the OLD buggy behavior (skipped updates)"
if grep -q "unable to find existing template ID" "$WORK/import.log"; then
  echo "!! FAIL: templates were SKIPPED (old bug still present)"
  exit 1
fi

echo "==> 4/4 Re-export and confirm sentinel persisted server-side"
$CLI export --format=yaml --output_folder="$WORK/verify" --config_file="$CONFIG"
if grep -q "$SENTINEL" "$WORK/verify/tenant.yaml"; then
  echo "==> PASS: sentinel '$SENTINEL' present after round-trip. Fix works."
else
  echo "!! FAIL: sentinel not found after re-export. Update did not persist."
  exit 1
fi

echo "==> Done. Artifacts in $WORK (contains credentials in config.json — delete when finished)."
