# Keyword Replacement

The Deploy CLI supports dynamic keyword replacement with environment-specific values. This enables a scalable multi-tenant workflow where all tenants share the same resource configuration files but inject subtly different values.

To use the keyword replacement, the `AUTH0_KEYWORD_REPLACEMENT_MAPPINGS` configuration property needs to contain the appropriate mappings. Then, in the resource configuration files, keywords can be injected through one of two ways:

- `@@EXAMPLE_KEY@@`: Using the `@` symbols causes the tool to perform a `JSON.stringify` on your value before replacing it. So if your value is a string, the tool will add quotes; if your value is an array or object, the tool will add braces.
- `##EXAMPLE_KEY##`: Using the `#` symbol causes the tool to perform a literal replacement; it will not add quotes or brackets.

### Example `config.json`

```json
{
  "AUTH0_DOMAIN": "test-tenant.us.auth0.com",
  "AUTH0_CLIENT_ID": "FOO",
  "AUTH0_CLIENT_SECRET": "BAR",
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "ENVIRONMENT": "dev",
    "ALLOWED_LOGOUTS": ["https://dev-test-site.com/logout", "localhost:3000/logout"],
    "ALLOWED_ORIGINS": ["https://dev-test-site.com", "localhost:3000"]
  }
}
```

### Example `tenant.yaml`

```yaml
tenant:
  friendly_name: My ##ENVIRONMENT## tenant
  allowed_logout_urls: @@ALLOWED_LOGOUTS@@
  enabled_locales:
    - en
clients:
  - name: Test App
    allowed_origins: @@ALLOWED_ORIGINS@@
    allowed_logout_urls: @@ALLOWED_LOGOUTS@@
```

## Uni-directional Limitation

Currently, the Deploy CLI only preserves keywords during import. Once added, keywords are overwritten with subsequent exports. For this reason, it is recommended that if a workflow heavily depends on keyword replacement, to only perform imports in perpetuity. This limitation is noted in [this Github issue](https://github.com/auth0/auth0-deploy-cli/issues/328).
