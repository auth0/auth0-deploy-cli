# How to manage E2E testing recordings

## Re-recording

Ensure `AUTH0_E2E_TENANT_DOMAIN`, `AUTH0_E2E_CLIENT_ID`, `AUTH0_E2E_CLIENT_SECRET` env vars are set.

Then delete the recording file that you are attempting to re-record. Example: `rm test/e2e/recordings/should-deploy-while-deleting-resources-if-AUTH0_ALLOW_DELETE-is-true.json`

Finally, run the following command:

```shell
AUTH0_HTTP_RECORDINGS="record" npx ts-mocha --timeout=120000 -p tsconfig.json test/e2e/e2e.test.ts -g="<SPECIFIC_TEST_TO_TARGET>"
```

**Example:**

```shell
AUTH0_HTTP_RECORDINGS="record" npx ts-mocha --timeout=120000 -p tsconfig.json test/e2e/e2e.test.ts -g="AUTH0_ALLOW_DELETE is true"
```

### Common Errors When Re-Recording

- `access_denied: {"error":"access_denied","error_description":"Unauthorized"}` - The client ID/secret pair provided through `AUTH0_E2E_CLIENT_ID` and `AUTH0_E2E_CLIENT_SECRET` respectively is not valid, double-check their correct values.
- `APIError: Nock: Disallowed net connect for "auth0-deploy-cli-e2e.us.auth0.com:443/oauth/token"` - Recordings already exist for this test, will need to remove the correlating recordings file and try again. Re-recording the entire file is necessary even if HTTP request changes are additive.

## Running Tests w/ Recordings

**Run for all:**

```shell
AUTH0_HTTP_RECORDINGS="lockdown" npm run test:e2e:node-module
```

**Run a specific test:**

```shell
AUTH0_HTTP_RECORDINGS="lockdown" npx ts-mocha --timeout=120000 -p tsconfig.json test/e2e/e2e.test.ts -g="should deploy while deleting resources if AUTH0_ALLOW_DELETE is true"
```
