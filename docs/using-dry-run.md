# Using Dry Run

The Auth0 Deploy CLI supports a "dry run" mode that allows you to preview all potential changes to your Auth0 tenant without actually applying them. This feature provides a safety net for validating configurations and understanding the impact of deployments before they occur.

[Discussions thread](https://github.com/auth0/auth0-deploy-cli/discussions/1092?sort=new)

## Usage

### Command Line Interface

Add the `--dry_run` flag to your import command:

```bash
a0deploy import --config_file=config.json --input_file=./tenant.yaml --dry_run
```

Or use the shorter form:

```bash
a0deploy import -c config.json -i ./tenant-directory --dry_run
```

### Node Module

Set the `AUTH0_DRY_RUN` configuration property to `true`:

```javascript
import { deploy } from 'auth0-deploy-cli';

deploy({
  input_file: './local/tenant.yaml',
  config: {
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
    AUTH0_DRY_RUN: true,
  },
})
  .then(() => {
    console.log('Dry run completed successfully');
  })
  .catch((err) => {
    console.log('Error during dry run:', err);
  });
```

**Note**: Using `AUTH0_DRY_RUN` will present an interactive prompt to select options after displaying the dry run preview.

### Environment Variable

You can also enable dry run mode using an environment variable:

```bash
export AUTH0_DRY_RUN=true
a0deploy import -c config.json -i ./tenant.yaml
```

## Understanding the Output

Dry run mode provides a detailed preview of all proposed changes in a table format:

```text
Auth0 Deploy CLI - Dry Run Preview

Tenant: example-tenant.auth0.com
Input: local/tenant.yaml

Simulating deployment... The following changes are proposed:

| Resource      | Status  | Name / Identifier                |
|---------------|---------|----------------------------------|
| Actions       | CREATE  | Post-Login User Enrichment       |
|               | CREATE  | Pre-Registration Validation      |
|               | DELETE* | Deprecated Action                |
| Clients       | CREATE  | New SPA Application              |
|               | UPDATE  | Existing M2M Application         |
| Connections   | UPDATE  | Username-Password-Authentication |

* Requires AUTH0_ALLOW_DELETE to be enabled

Dry Run completed successfully. No changes have been made to your Auth0 tenant.

┌ dry-run
│
◆ What would you like to do?
│ ○ Apply changes
│ ○ Export changes in a file (No Apply)
│ ○ Exit
└
```

## Interactive Options

After displaying the dry run preview, the CLI presents interactive options:

- **Apply changes**: Proceed to apply all the changes shown in the preview
- **Export changes in a file**: Save the changes to a `dry-run-diff-log.json` file without applying them
- **Exit**: Cancel the operation without making any changes

## Resource Deletion Preview

When `AUTH0_ALLOW_DELETE` is enabled, dry run will show which resources would be deleted:

```bash
# Enable deletions in your config
export AUTH0_ALLOW_DELETE=true
a0deploy import -c config.json -i ./tenant.yaml --dry_run
```

Resources marked for deletion will appear in the output with `DELETE*` status, and the asterisk note will explain that `AUTH0_ALLOW_DELETE` must be enabled for deletions to occur.

## Validation and Error Handling

Dry run performs the same validation as a regular deployment:

- **Schema Validation**: Ensures all resources conform to Auth0's expected structure
- **Business Rule Validation**: Checks for conflicts, required fields, and logical constraints
- **Configuration Validation**: Validates keyword replacements and file references

If validation errors are found, dry run will report them without making any changes:

```text
Validation Error: Rule "My Rule" - Names must be unique
Error: Configuration validation failed. No changes made.
```

## No Changes Detected

If no changes are detected between your configuration and the current tenant state, dry run will display:

```text
Auth0 Deploy CLI - Dry Run Preview

Tenant: example-tenant.auth0.com
Input: ./tenant-config/

Simulating deployment... The following changes are proposed:

No changes detected.

Dry Run completed successfully. No changes have been made to your Auth0 tenant.
```

## Best Practices

1. **Always Dry Run First**: Make dry run a standard part of your deployment workflow, especially for production environments.

2. **Review All Changes**: Carefully examine the proposed changes, paying special attention to deletions and updates to critical resources.

3. **Validate in Stages**: For large configuration changes, consider breaking them into smaller deployments and dry running each stage.

4. **Check Dependencies**: Ensure that resource dependencies (like client grants referencing specific clients) are properly configured.

5. **Environment Consistency**: Use dry run to verify that keyword replacements produce the expected values for your target environment.

## Limitations and Considerations

- **State Changes**: The actual tenant state may change between running a dry run and the actual deployment. The dry run reflects the state at the time it was executed.

- **API Limitations**: Some validation can only be performed during actual API calls. Dry run performs as much validation as possible without making changes.

- **Resource Dependencies**: Complex dependencies between resources might only be fully validated during actual deployment.

- **External Factors**: Changes made by other users or processes to the Auth0 tenant are not reflected in the dry run results.

## Troubleshooting

### Common Issues

**Configuration Errors**: If you see configuration-related errors, verify your keyword replacement mappings and file paths.

**Authentication Issues**: Ensure your Auth0 client has the necessary scopes to read all resources you're trying to manage.

**File Not Found**: Check that all referenced files (scripts, templates, etc.) exist and are accessible.

**Format Mismatches**: Verify that your input format matches your configuration. Using YAML format with JSON-specific dry run configurations may cause issues, and vice versa. Ensure consistency between your input file format and configuration settings.

### Getting Help

If you encounter issues with dry run mode:

1. Enable debug logging: `--debug` flag or `AUTH0_DEBUG=true`
2. Check the [troubleshooting guide](./troubleshooting.md)
3. Review your configuration against the [documentation](./configuring-the-deploy-cli.md)
4. Open an issue on the [GitHub repository](https://github.com/auth0/auth0-deploy-cli/issues)
