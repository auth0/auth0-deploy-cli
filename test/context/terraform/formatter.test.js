const fromJSON = require('../../../src/context/terraform/formatter').default;
const { assert } = require('chai');

describe('HCL formatter tests', () => {
  it('role HCL', () => {
    var result = fromJSON({
      type: 'auth0_role',
      name: 'My Test Role',
      content: {
        name: 'My Test Role',
        description: 'A test role',
        permissions: [
          {
            resource_server_identifier: 'https://test-api',
            name: 'read:stuff'
          }, {
            resource_server_identifier: 'https://test-api',
            name: 'write:stuff'
          }
        ]
      }
    });
    assert.equal(result, `resource auth0_role "My_Test_Role" {
  name = "My Test Role"
  description = "A test role"
  permissions {
    resource_server_identifier = "https://test-api"
    name = "read:stuff"
  }
  permissions {
    resource_server_identifier = "https://test-api"
    name = "write:stuff"
  }
}`);
  });

  it('tenant HCL', () => {
    var result = fromJSON({
      type: 'auth0_tenant',
      name: 'test-tenant',
      content: {
        enabled_locales: [ 'en' ],
        idle_session_lifetime: 123.4,
        flags: { disable_clickjack_protection_headers: false },
        empty: {},
        allowed_logout_urls: [
          'http://mysite/logout',
          'http://myothersite/logout'
        ]
      }
    });
    assert.equal(result, `resource auth0_tenant "test-tenant" {
  enabled_locales = [
    "en"
  ]
  idle_session_lifetime = 123.4
  flags {
    disable_clickjack_protection_headers = false
  }
  empty {}
  allowed_logout_urls = [
    "http://mysite/logout",
    "http://myothersite/logout"
  ]
}`);
  });

  it('rule HCL', () => {
    var result = fromJSON({
      type: 'auth0_rule',
      name: 'Empty rule',
      content: {
        name: 'Empty rule',
        script: `function (user, context, callback) {
  // TODO: implement your rule
  return callback(null, user, context);
}`,
        order: 1,
        enabled: true
      }
    });
    assert.equal(result, `resource auth0_rule "Empty_rule" {
  name = "Empty rule"
  script = <<EOT
function (user, context, callback) {
  // TODO: implement your rule
  return callback(null, user, context);
}
EOT
  order = 1
  enabled = true
}`);
  });
});
