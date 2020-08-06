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
        flags: { disable_clickjack_protection_headers: false }
      }
    });
    assert.equal(result, `resource auth0_tenant "test-tenant" {
  enabled_locales = [
    "en"
  ]
  flags {
    disable_clickjack_protection_headers = false
  }
}`);
  });
});
