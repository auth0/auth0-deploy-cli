# Keyword Replacement

The Deploy CLI supports dynamic keyword replacement with environment-specific values. This enables a scalable multi-tenant workflow where all tenants share the same resource configuration files but inject subtly different values.

To use the keyword replacement, the `AUTH0_KEYWORD_REPLACEMENT_MAPPINGS` configuration property needs to contain the appropriate mappings. Then, in the resource configuration files, keywords can be injected through one of two ways:

- `@@EXAMPLE_KEY@@`: Using the `@` symbols causes the tool to perform a `JSON.stringify` on your value before replacing it. So if your value is a string, the tool will add quotes; if your value is an array or object, the tool will add braces.
- `##EXAMPLE_KEY##`: Using the `#` symbol causes the tool to perform a literal replacement; it will not add quotes or braces.

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

## Array Concatenation

You may encounter situations where you would want to concatenate values onto a static array through keyword replacement. There is no special syntax to support this case, however, it is possible to achieve this by escaping double quotes in a single string that contains the appropriate values and injecting with the `##` keyword syntax. This technique works for both the [YAML and directory formats](./available-resource-config-formats.md).

### Example `config.json`

```json
{
  "AUTH0_KEYWORD_REPLACE_MAPPINGS": {
    "GLOBAL_WEB_ORIGINS": "\"http://local.me:8080\", \"http://localhost\", \"http://localhost:3000\""
  }
}
```

### Example `tenant.yaml`

```yaml
clients:
  - name: Test App
    web_origins: [ "http://production-app.com", "https://production-app.com", ##GLOBAL_WEB_ORIGINS## ]
```

## Preserving Keywords on Export

Generally, the Deploy CLI works best when operating in a uni-directional workflow from your lower-level environments (ex: dev, test) up to your production environments. However, there will be times when it is necessary to export configuration from a higher-level environment onto your local configuration directory. By default, the remote values will overwrite your local values, **causing the deletion of your keyword markers**. However, keyword replacement preservation can be enabled through the `AUTH0_PRESERVE_KEYWORDS` boolean configuration property. By enabling this configuration, the Deploy CLI will attempt to preserve the keyword markers defined in your local configuration files during export.

The keyword preservation functionality will attempt to preserve as many keywords while also maintaining the accuracy of your resource configuration files. And it the majority of cases, it will work without any intervention by the user. However, some key limitations exist:

- In the case of a keyword-replaced configuration field with differing values between local and remote, the local configuration value will _always_ be favored. This will
- Arrays without a specific identifiers are not eligible for preservation. Ex: `[ "http://site.com/logout", "localhost:3000/logout", "##LOGOUT_URL##" ]`. This is because the ordering of these values are non-deterministic. Alternatively, to preserve these values, it is recommended to leverage the `@@ARRAY_REPLACE@@` keyword replace syntax with the entire value.

To learn more about the history and technical challenges of of keyword preservation, refer to [RFC: Keyword Preservation During Export](https://github.com/auth0/auth0-deploy-cli/issues/688).

---

[[table of contents]](../README.md#documentation)
