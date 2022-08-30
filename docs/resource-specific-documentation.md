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
