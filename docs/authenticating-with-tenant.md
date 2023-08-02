# Authenticating with your Tenant

There are three available methods of authenticating the Deploy CLI with your tenant:

- [Client Credentials](#client-credentials)
- [Private Key JWT](#private-key-JWT)
- [Access Token](#access-token)

## Client Credentials

Authenticating with a client ID and client secret pair. This option is straightforward and enables the quickest path to setup for the tool. In order to utilize, set both the `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` configuration values with the client ID and client secret respectively. These credentials can be found under the "Credentials" tab within the designated application used for the Deploy CLI.

## Private Key JWT

Providing a private key to facilitate asymmetric key pair authentication. This requires the "Private Key JWT" authentication method for the designated client as well as a public key configured on the remote tenant. This may be appealing to developers who do not wish to have credentials stored remotely on Auth0.

To utilize, pass the path of the private key through the `AUTH0_CLIENT_SIGNING_KEY_PATH` configuration property either as an environment variable or property in your `config.json` file. This path is relative to the working directory. Optionally, you can specify the signing algorithm through the `AUTH0_CLIENT_SIGNING_ALGORITHM` configuration property.

**Example: **

```
{
    "AUTH0_CLIENT_SIGNING_KEY_PATH": "./private.pem",
    "
}
```

See [Configure Private Key JWT Authentication](https://auth0.com/docs/get-started/applications/configure-private-key-jwt) for further documentation

## Access Token

Passing in an access token directly is also supported. This option puts more onus on the developers but can enable flexible and specific workflows when necessary. It can be leveraged by passing the Auth0 access token in via the `AUTH0_ACCESS_TOKEN` environment variable.

[[table of contents]](../README.md#documentation)
