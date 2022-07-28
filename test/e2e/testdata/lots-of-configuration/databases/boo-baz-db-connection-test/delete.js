function remove(id, callback) {
  // This script remove a user from your existing database.
  // It is executed whenever a user is deleted from the API or Auth0 dashboard.
  //
  // There are two ways that this script can finish:
  // 1. The user was removed successfully:
  //     callback(null);
  // 2. Something went wrong while trying to reach your database:
  //     callback(new Error("my error message"));

  const msg =
    'Please implement the Delete script for this database ' +
    'connection at https://manage.auth0.com/#/connections/database';
  return callback(new Error(msg));
}
