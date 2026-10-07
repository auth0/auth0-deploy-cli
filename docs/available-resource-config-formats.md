# Available Resource Config Formats

Auth0 resource state is expressed in two available different configuration file formats: YAML and JSON (aka “directory”). When using the Deploy CLI’s export command, you will be prompted with the choice of one versus the other.

## YAML

The YAML format is expressed mostly as a flat `tenant.yaml` file with supplemental code files for resources like actions and email templates. The single file makes tracking changes over time in version control more straightforward. Additionally, the single file eliminates a bit of ambiguity with directory and file names, which may not be immediately obvious.

### Splitting a YAML config across files with `!include`

For large tenants, a single `tenant.yaml` can become unwieldy. The `!include` directive lets you move any section into its own file and reference it from the main config:

```yaml
# tenant.yaml
tenant:
  friendly_name: 'My Tenant'

clients: !include clients.yaml
roles: !include roles.yaml
```

```yaml
# clients.yaml
- name: My App
  app_type: spa
```

Notes and restrictions:

- Includes are resolved on import (`a0deploy import -i tenant.yaml`). They are **not** supported in the directory format.
- The `!include` path is resolved relative to the file that declares it. For security, an included file must resolve **inside the config root**; a path that escapes it with `../` or an absolute path is rejected with a `Path traversal blocked` error. This is the same guard (and the same root) applied to every other file reference.
- The config root is `AUTH0_BASE_PATH` when that is set, otherwise the directory of the entry file passed to `-i`. If you set `AUTH0_BASE_PATH` to a directory that does not contain your `tenant.yaml`, includes next to `tenant.yaml` can be rejected as traversal, so point `AUTH0_BASE_PATH` at the directory that holds your config.
- Relative file references **inside** an included file (an action's `code:`, an email template body, and similar) still resolve from the config root, not from the included file's own directory. For example, an action split into `actions/actions.yaml` that points at `code.js` should reference it relative to the root (`actions/code.js`), not as a bare `code.js` sitting beside `actions.yaml`.
- Includes may be nested (an included file may itself use `!include`). Circular includes are detected and reported rather than looping forever.
- Keyword replacement (`@@KEY@@` / `##KEY##`) is applied to included files just as it is to the main file.
- Export does not emit `!include`; `a0deploy export` writes a single flattened `tenant.yaml`. Export to a separate folder if you keep a split config, otherwise the flattened `tenant.yaml` overwrites your entry file and the included files are left orphaned.

## Directory (JSON)

The directory format separates resource types into separate directories, with each single resource living inside a dedicated JSON file. This format allows for easier conceptual separation between each type of resource as well as the individual resources themselves. Also, the Deploy CLI closely mirrors the data shapes defined in the [Auth0 Management API](https://auth0.com/docs/api/management/v2), so referencing the JSON examples in the docs may provide useful when using this format.

## How to Choose

The decision to select which format to use should be primarily made off of preference. Both formats are tenable solutions that achieve the same task, but with subtly different strengths and weaknesses described above. Be sure to evaluate each in the context of your context. Importantly, **this choice is not permanent**, and switching from one to the other via the import command is an option at your disposal.

---

[[table of contents]](../README.md#documentation)
