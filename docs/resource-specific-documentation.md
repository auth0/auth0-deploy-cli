# Resource-specific Documentation

In general, the Deploy CLI resource configuration files closely match the payload schemas of the [Management API](https://auth0.com/docs/api/management/v2).

However, there are some notable nuances to be aware of:

## Client Grants

The Deploy CLI's own client grant is intentionally not exported nor configurable by itself. This is done to prevent breaking changes, otherwise the tool could potentially revoke access or otherwise crash in the midst of an import. In a multi-tenant, multi-environment context, it is expect that new tenants will have a designated client already established for the Deploy CLI, as mentioned in the [getting started instructions](./../README.md#create-a-dedicated-auth0-application).

## Prompts

Multilingual custom text prompts follow a particular hierarchy. Under the root-level `prompts` resource property is a proprietary `customText` property that is used to bundle custom text translations with other prompts settings. Underneath `customText` is the two-character language code. Thirdly is the prompt ID, followed by the screen ID, followed by text ID.

RenderSettings of a prompt-screen follow a particular hierarchy. Under the root-level `prompts` we store `screenRenderers` property that is used to configure the rendering settings of a given prompt & screen. Thirdly is the prompt Name, followed by the screen Name mapped to the respective renderer configs file. Refer [more](https://auth0.com/docs/customize/login-pages/advanced-customizations/getting-started/configure-acul-screens) on this.

**Hierarchy**

```yaml
prompts:
  customText:
    <LANGUAGE>: # two character language code
      <PROMPT_ID>: # prompt ID
        <SCREEN_ID>: # prompt screen ID
          <TEXT_ID>: 'Some text'
    screenRenderers:
      - <PROMPT-NAME>:
          <SCREEN-NAME>: ./prompts/screenRenderSettings/promptName_screenName.json #Add the renderer configs for a given prompt & a given screen
```

**YAML Example**

```
Folder structure when in YAML mode.

./prompts/
    /screenRenderSettings
        /signup-id_signup-id.json
        /login-id_login-id.json
        /login-passwordless_login-passwordless-email-code.json
        /login-passwordless_login-passwordless-sms-otp.json
        /login-password_login-password.json
        /signup-password_signup-password.json
./tenant.yaml
```

```yaml
# Contents of ./tenant.yaml
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
  screenRenderers:
    - signup-id:
        signup-id: ./prompts/screenRenderSettings/signup-id_signup-id.json
    - login-passwordless:
        login-passwordless-email-code: ./prompts/screenRenderSettings/login-passwordless_login-passwordless-email-code.json
        login-passwordless-sms-otp: ./prompts/screenRenderSettings/login-passwordless_login-passwordless-sms-otp.json
```

**Directory Example**

```
Folder structure when in directory mode.

./prompts/
    /screenRenderSettings
        /signup-id_signup-id.json
        /login-id_login-id.json
        /login-passwordless_login-passwordless-email-code.json
        /login-passwordless_login-passwordless-sms-otp.json
        /login-password_login-password.json
        /signup-password_signup-password.json
    /custom-text.json
    /prompts.json
```

Contents of `promptName_screenName.json`

```json
{
  "prompt": "signup-id",
  "screen": "signup-id",
  "rendering_mode": "advanced",
  "context_configuration": ["branding.settings", "branding.themes.default"],
  "default_head_tags_disabled": false,
  "head_tags": [
    {
      "tag": "script",
      "attributes": {
        "src": "URL_TO_YOUR_ASSET",
        "async": true,
        "defer": true,
        "integrity": ["ASSET_SHA"]
      }
    }
  ],
  "filters": {
    "match_type": "includes_any",
    "clients": [
      {
        "id": "SeunfRe6p8EXxV6I0g9kMYdT1DxpfC38",
        "metadata": { "key1": "value1" }
      }
    ]
  },
  "use_page_template": false
}
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

## emailTemplates

When managing email templates, the values of `options.body` and `options.body` point to specific HTML files relative to the path of the output folder. Otherwise, the payload closely matches that of the [Management API](https://auth0.com/docs/api/management/v2#!/Email_Templates/post_email_templates).

**YAML Example**

```
Folder structure when in YAML mode.

./emailTemplates/
    ./verify_email.html
    ./welcome_email.html
    ./password_reset.html
    ./reset_email.html
    ./reset_email_by_code.html
./tenant.yaml
```

```yaml
# Contents of ./tenant.yaml
emailTemplates:
  - template: 'verify_email'
    enabled: true
    syntax: 'liquid'
    from: 'test@email.com'
    subject: 'something'
    body: 'emailTemplates/change_email.html'

  - template: 'welcome_email'
    enabled: true
    syntax: 'liquid'
    from: 'test@email.com'
    subject: 'something'
    body: 'emailTemplates/change_email.html'

  - template: 'password_reset'
    enabled: true
    syntax: 'liquid'
    from: 'test@email.com'
    subject: 'something'
    body: 'emailTemplates/change_email.html'

  - template: 'reset_email_by_code'
    enabled: true
    syntax: 'liquid'
    from: 'test@email.com'
    subject: 'something'
    body: 'emailTemplates/change_email.html'
```

**Directory Example**

```
Folder structure when in directory mode.
./emailTemplates/
    ./welcome_email.html
    ./welcome_email.json
    ./reset_email.html
    ./reset_email.json
    ./reset_email_by_code.html
    ./reset_email_by_code.json
```

Contents of `welcome_email.json`

```json
{
  "name": "welcome_email",
  "enabled": true,
  "html": "./welcome_email.html"
}
```

Contents of `reset_email.json`

```json
{
  "name": "reset_email",
  "enabled": true,
  "html": "./reset_email.html"
}
```

Contents of `reset_email_by_code.json`

```json
{
  "name": "reset_email_by_code",
  "enabled": true,
  "html": "./reset_email_by_code.html"
}
```

## Branding

This resource allows to manage branding within your Auth0 tenant. Auth0 can be customized with a look and feel that aligns with your organization's brand requirements and user expectations. `universal_login` template can be customized (make sure to add `read:custom_domains` scope to export templates).

**YAML Example**

Folder structure when in YAML mode.

```yaml
branding:
  colors:
    page_background: '#FF4F40'
    primary: '#2A2E35'
  favicon_url: https://example.com/favicon.png
  font:
    url: https://example.com/font.woff
  logo_url: https://example.com/logo.png
  templates:
    - template: universal_login
      body: ./branding_templates/universal_login.html
```

**Directory Example**

Folder structure when in directory mode.

```json
{
  "colors": {
    "page_background": "#FF4F40",
    "primary": "#2A2E35"
  },
  "favicon_url": "https://example.com/favicon.png",
  "font": {
    "url": "https://example.com/font.woff"
  },
  "logo_url": "https://example.com/logo.png"
}
```

For `universal_login` template `templates/` will be created.

- `templates/universal_login.html`

```html
<!DOCTYPE html>
<html>
  <head>
    {%- auth0:head -%}
  </head>
  <body>
    {%- auth0:widget -%}
    <div>page teamplate</div>
  </body>
</html>
```

- `templates/universal_login.json`

```json
{
  "template": "universal_login",
  "body": "./universal_login.html"
}
```

## NetworkACL

Tenant Network Access Control Lists (NetworkACLs) allow you to configure rules that control access to your Auth0 tenant based on IP addresses, geographical locations, and other network criteria. The Deploy CLI supports managing NetworkACLs in both directory and YAML modes.Refer [more](https://auth0.com/docs/secure/tenant-access-control-list/configure-rules) on this.

NetworkACLs have the following key properties:

- `description`: A descriptive name for the rule
- `active`: Boolean indicating if the rule is active
- `priority`: Number between 1-10 determining the order of rule evaluation (lower numbers have higher priority)
- `rule`: The rule configuration containing:
  - `action`: The action to take (block, allow, log, or redirect)
  - `scope`: The scope of the rule ('management', 'authentication', or 'tenant')
  - `match` or `not_match`: Criteria for matching requests

**YAML Example**

```yaml
# Contents of ./tenant.yaml
networkACLs:
  - description: 'Allow Specific Countries'
    active: true
    priority: 2
    rule:
      action:
        allow: true
      scope: 'authentication'
      match:
        geo_country_codes: ['US', 'CA']
  - description: 'Redirect Specific User Agents'
    active: true
    priority: 3
    rule:
      action:
        block: true
      scope: 'management'
      not_match:
        user_agents: ['BadBot/1.0']
```

**Directory Example**

```
Folder structure when in directory mode.

./networkACLs/
    ./Allow Specific Countries-p-2.json
    ./Redirect Specific User Agents-p-3.json
```

Contents of `Allow Specific Countries-p-2.json`:

```json
{
  "description": "Allow Specific Countries",
  "active": true,
  "priority": 2,
  "rule": {
    "action": {
      "allow": true
    },
    "scope": "authentication",
    "match": {
      "geo_country_codes": ["US", "CA"]
    }
  }
}
```

Contents of `Redirect Specific User Agents-p-3.json`:

```json
{
  "description": "Redirect Specific User Agents",
  "active": true,
  "priority": 3,
  "rule": {
    "action": {
      "block": true
    },
    "scope": "management",
    "match": {
      "user_agents": ["BadBot/1.0"]
    }
  }
}
```

## PhoneProviders

When managing phone providers, credentials are never exported.

For the Twilio `phoneProvider`, we add the placeholder `##TWILIO_AUTH_TOKEN##` for the credential's `auth_token`, which can be used with keyword replacement.

Refer to [keyword-replacement.md](keyword-replacement.md), [multi-environment-workflow.md](multi-environment-workflow.md), and the [Management API](https://auth0.com/docs/api/management/v2/branding/create-phone-provider) for more details.

**YAML Example**

```yaml
# Contents of ./tenant.yaml
phoneProviders:
  - name: twilio
    configuration:
      sid: 'twilio_sid'
      default_from: '+1234567890'
      delivery_methods:
        - text
        - voice
    disabled: false
    credentials:
      auth_token: '##TWILIO_AUTH_TOKEN##'
```

**Directory Example**

```json
[
  {
    "name": "twilio",
    "disabled": true,
    "configuration": {
      "sid": "twilio_sid",
      "default_from": "+1234567890",
      "delivery_methods": ["text", "voice"]
    },
    "credentials": {
      "auth_token": "##TWILIO_AUTH_TOKEN##"
    }
  }
]
```

## PhoneTemplates

Phone templates allow you to customize the SMS and voice messages sent to users for phone-based authentication.
Refer to the [Management API](https://auth0.com/docs/api/management/v2/branding/get-phone-templates) for more details.

### YAML Example

```yaml
# Contents of ./tenant.yaml
phoneTemplates:
  - type: otp_verify
    disabled: false
    content:
      from: '+12341234567'
      body:
        text: 'Your verification code is {{ code }}'
        voice: 'Your verification code is {{ code }}'
  - type: otp_enroll
    disabled: false
    content:
      from: '+12341234567'
      body:
        text: 'Your enrollment code is {{ code }}'
```

### Directory Example

Create individual JSON files for each template in the `phone-templates` directory:

```text
phone-templates/
├── otp_verify.json
├── otp_enroll.json
├── change_password.json
└── ...
```

Example `phone-templates/otp_verify.json`:

```json
{
  "type": "otp_verify",
  "disabled": false,
  "content": {
    "from": "+12341234567",
    "body": {
      "text": "Your verification code is {{ code }}",
      "voice": "Your verification code is {{ code }}"
    }
  }
}
```
