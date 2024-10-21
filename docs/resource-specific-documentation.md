# Resource-specific Documentation

In general, the Deploy CLI resource configuration files closely match the payload schemas of the [Management API](https://auth0.com/docs/api/management/v2).

However, there are some notable nuances to be aware of:

## Client Grants

The Deploy CLI's own client grant is intentionally not exported nor configurable by itself. This is done to prevent breaking changes, otherwise the tool could potentially revoke access or otherwise crash in the midst of an import. In a multi-tenant, multi-environment context, it is expect that new tenants will have a designated client already established for the Deploy CLI, as mentioned in the [getting started instructions](./../README.md#create-a-dedicated-auth0-application).

## Prompts

Multilingual custom text prompts follow a particular hierarchy. Under the root-level `prompts` resource property is a proprietary `customText` property that is used to bundle custom text translations with other prompts settings. Underneath `customText` is the two-character language code. Thirdly is the prompt ID, followed by the screen ID, followed by text ID.

**Hierarchy**

```yaml
prompts:
  customText:
    <LANGUAGE>: # two character language code
      <PROMPT_ID>: # prompt ID
        <SCREEN_ID>: # prompt screen ID
          <TEXT_ID>: 'Some text'
```

**Example**

```yaml
prompts:
  identifier_first: true
  universal_login_experience: classic
  customText:
    en:
      login:
        login:
          description: Login description in english
          buttonText: Button text
      mfa:
        mfa-detect-browser-capabilities:
          pickAuthenticatorText: 'Try another method'
          reloadButtonText: 'Reload'
          noJSErrorTitle: 'JavaScript Required'
        mfa-login-options:
          pageTitle: 'Log in to ${clientName}'
          authenticatorNamesSMS: 'SMS'
```

## Databases

When managing database connections, the values of `options.customScripts` point to specific javascript files relative to
the path of the output folder. Otherwise, the payload closely matches that of the [Management API](https://auth0.com/docs/api/management/v2#!/Connections/post_connections).

**YAML Example**

```
Folder structure when in YAML mode.

./databases/
    /Username-Password-Authentication
        /change_password.js
        /create.js
        /delete.js
        /get_user.js
        /login.js
        /verify.js
./tenant.yaml
```

```yaml
# Contents of ./tenant.yaml
databases:
  - name: Username-Password-Authentication
    # ...
    options:
      # ...
      customScripts:
        change_password: ./databases/Username-Password-Authentication/change_password.js
        create: ./databases/Username-Password-Authentication/create.js
        delete: ./databases/Username-Password-Authentication/delete.js
        get_user: ./databases/Username-Password-Authentication/get_user.js
        login: ./databases/Username-Password-Authentication/login.js
        verify: ./databases/Username-Password-Authentication/verify.js
```

**Directory Example**

```
Folder structure when in directory mode.

./database-connections/
    ./Username-Password-Authentication/
        ./change_password.js
        ./create.js
        ./database.json
        ./delete.js
        ./get_user.js
        ./login.js
        ./verify.js
```

Contents of `database.json`

```json
{
  "options": {
    "customScripts": {
      "change_password": "./change_password.js",
      "create": "./create.js",
      "delete": "./delete.js",
      "get_user": "./get_user.js",
      "login": "./login.js",
      "verify": "./verify.js"
    }
  }
}
```

## Universal Login

### Pages

When overriding the Universal Login with custom HTML, the error, login, multi-factor authentication and password reset
contents are organized in specific HTML pages.

**YAML Example**

```
Folder structure when in YAML mode.

./pages/
    /error_page.html
    /guardian_multifactor.html
    /login.html
    /password_reset.html
./tenant.yaml
```

```yaml
# Contents of ./tenant.yaml
pages:
  - name: error_page
    html: ./pages/error_page.html
    show_log_link: false
    url: https://mycompany.org/error
  - name: guardian_multifactor
    enabled: true
    html: ./pages/guardian_multifactor.html
  - name: login
    enabled: false
    html: ./pages/login.html
  - name: password_reset
    enabled: true
    html: ./pages/password_reset.html
```

**Directory Example**

```
Folder structure when in directory mode.

./pages/
    ./error_page.html
    ./error_page.json
    ./guardian_multifactor.html
    ./guardian_multifactor.json
    ./login.html
    ./login.json
    ./password_reset.html
    ./password_reset.json
```

Contents of `login.json`

```json
{
  "name": "login",
  "enabled": false,
  "html": "./login.html"
}
```

Contents of `error_page.json`

```json
{
  "html": "./error_page.html",
  "show_log_link": false,
  "url": "https://mycompany.org/error",
  "name": "error_page"
}
```

Contents of `guardian_multifactor.json`

```json
{
  "enabled": true,
  "html": "./guardian_multifactor.html",
  "name": "guardian_multifactor"
}
```

Contents of `password_reset.json`

```json
{
  "enabled": true,
  "html": "./password_reset.html",
  "name": "password_reset"
}
```
