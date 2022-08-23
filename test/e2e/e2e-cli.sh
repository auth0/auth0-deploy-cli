#!/bin/sh
set -e

WORK_DIR="./local/cli"
CONFIG_FILE="./config-cli-e2e.json"

npm ci #Install all dependencies to allow for building
npm run build
npm ci --omit=dev #Remove dev dependencies

TARBALL_PATH=$(npm pack)
sudo npm install -g $TARBALL_PATH

echo "{
  \"AUTH0_DOMAIN\": \"$AUTH0_E2E_TENANT_DOMAIN\",
  \"AUTH0_CLIENT_ID\": \"$AUTH0_E2E_CLIENT_ID\",
  \"AUTH0_CLIENT_SECRET\": \"$AUTH0_E2E_CLIENT_SECRET\"
}" > $CONFIG_FILE

a0deploy export --env=false --output_folder=$WORK_DIR --format=yaml -c=$CONFIG_FILE

echo "-------- Beginning deploy/import phase --------"

a0deploy import --env=false --input_file=$WORK_DIR --format=yaml -c=$CONFIG_FILE

rm $CONFIG_FILE
rm $TARBALL_PATH