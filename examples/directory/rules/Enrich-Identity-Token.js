function (user, context, callback) {
  const env = @@ENV@@;

  console.log(`env is ${env}`);

  // Add Env to Token
  context.idToken['https://myapp.com/env'] = @@ENV@@;

  callback(new Error(`This is just an example from auth0-deploy-cli, don\'t use this rule!`), user, context);
}
