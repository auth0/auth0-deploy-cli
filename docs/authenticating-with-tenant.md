# Authenticating with your Tenant

There are three available methods of authenticating the Deploy CLI with your tenant:

- [Client credentials](#client-credentials)
- [Private key](#private-key)
- [Access token](#access-token)

## Client Credentials

Authenticating with a client ID and client secret pair. This option is straightforward and enables

export AUTH0_CLIENT_ID=<YOUR_CLIENT_ID>
export AUTH0_CLIENT_SECRET=<YOUR_CLIENT_SECRET>

## Private Key

Providing a private key to facilitate asymmetric key pair authentication. This requires the "Private Key JWT" authentication method for the designated client as well as a public key. This may be appealing to developers who do not wish to have credentials stored remotely on Auth0.

To utilize, pass the `AUTH0_CLIENT_SIGNING_KEY`

See [Configure Private Key JWT Authentication](https://auth0.com/docs/get-started/applications/configure-private-key-jwt) for further documentation

## Access Token

Passing in an access token directly is also supported. This option puts more onus on the developers but can enable flexible and specific workflows when necessary. It can be leveraged by passing the Auth0 access token in via the `AUTH0_ACCESS_TOKEN` environment variable.

[[table of contents]](../README.md#documentation)
