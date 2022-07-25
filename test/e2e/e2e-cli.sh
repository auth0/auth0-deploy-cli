#!/bin/sh

npm run build

WORK_DIR="./local/cli"
CONFIG_FILE="./config-cli-e2e.json"


echo "{
  \"AUTH0_DOMAIN\": \"$AUTH0_E2E_TENANT_DOMAIN\",
  \"AUTH0_CLIENT_ID\": \"$AUTH0_E2E_CLIENT_ID\",
  \"AUTH0_CLIENT_SECRET\": \"$AUTH0_E2E_CLIENT_SECRET\",
}" > $CONFIG_FILE

node lib/index.js export --env=false --output_folder=$WORK_DIR --format=yaml -c=$CONFIG_FILE

echo "-------- Beginning deploy/import phase --------"

node lib/index.js import --env=false --output_folder=$WORK_DIR --format=yaml -c=$CONFIG_FILE

