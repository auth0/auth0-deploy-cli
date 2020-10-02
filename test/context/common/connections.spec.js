import _ from 'lodash';
import { constants } from 'auth0-source-control-extension-tools';

import dirHandler from '../../../src/context/directory/handlers/connections';
import yamlHandler from '../../../src/context/yaml/handlers/connections';

const exampleClients = [
  { name: 'client-idp-one-name', app_type: 'spa', client_id: 'client-idp-one-id' },
  { name: 'client1', app_type: 'spa', client_id: 'client1-id' }
];

const exampleConnections = {
  'my-ad-waad': {
    name: 'my/ad-waad', strategy: 'waad', var: 'something', enabled_clients: []
  },
  facebook: {
    name: 'facebook', strategy: 'facebook', var: 'something', enabled_clients: []
  },
  email: {
    name: 'email',
    strategy: 'email',
    enabled_clients: [],
    options: { email: { body: 'html code' } }
  },
  someSamlConnection: {
    name: 'someSamlConnection',
    strategy: 'samlp',
    enabled_clients: [ 'client1' ],
    options: {
      passwordPolicy: 'testPolicy',
      idpinitiated: {
        client_id: 'client-idp-one-name',
        client_protocol: 'samlp',
        client_authorizequery: ''
      }
    }
  },
  someSamlConnectionNoClientFound: {
    name: 'someSamlConnectionNoClientFound',
    strategy: 'samlp',
    enabled_clients: [ 'client2-id' ],
    options: {
      passwordPolicy: 'testPolicy',
      idpinitiated: {
        client_id: 'client-idp-two-id',
        client_protocol: 'samlp',
        client_authorizequery: ''
      }
    }
  },
  someSamlConnectionWithMultipleEnabledClients: {
    name: 'someSamlConnectionWithMultipleEnabledClients',
    strategy: 'samlp',
    enabled_clients: [ 'client1', 'client3', 'client2' ],
    options: {
      passwordPolicy: 'testPolicy',
      idpinitiated: {
        client_id: 'client-idp-three-id',
        client_protocol: 'samlp',
        client_authorizequery: ''
      }
    }
  }
};

function updateExpected(item) {
  const result = _.cloneDeep(item);
  if (result.name === 'email') {
    result.options.email.body = './email.html';
  }
  // clients should be sorted
  if (result.name === 'someSamlConnectionWithMultipleEnabledClients') {
    result.enabled_clients = [ 'client1', 'client2', 'client3' ];
  }
  return result;
}

export default {
  handlerType: 'connections',
  subDir: constants.CONNECTIONS_DIRECTORY,
  env: {
    AUTH0_KEYWORD_REPLACE_MAPPINGS: {
      secret: 'test secret',
      name: 'test-waad',
      domain: 'mydomain.com',
      var: 'something'
    }
  },
  formats: [
    {
      name: 'directory',
      handler: dirHandler
    },
    {
      name: 'yaml',
      handler: yamlHandler
    }
  ],
  clients: exampleClients,
  import: {
    directory: {
      files: {
        'azuread.json': '{ "name": "myad-waad", "strategy": "waad", "var": @@var@@ }',
        'facebook.json': '{  "name": "facebook", "strategy": "facebook", "var": @@var@@ }',
        'waad.json': '{"name":"test-waad","options":{"api_enable_users":true,"basic_profile":true,"client_id":"my_client_id","client_secret":"my_secret","domain":"somedomain.com","ext_groups":true,"ext_profile":true,"tenant_domain":"mydomain.com","waad_protocol":"openid-connect"},"strategy":"waad"}',
        'saml.json': '{"name":"someSamlConnection","strategy":"samlp","enabled_clients":["client1"],"options":{"passwordPolicy":"testPolicy","idpinitiated":{"client_id":"idp-one","client_protocol":"samlp","client_authorizequery":""}}}',
        'email.json': '{  "name": "email", "strategy": "email", "var": @@var@@, "options": { "email": { "body": "./email.html" } } }',
        'email.html': 'html code with ##secret##'
      }
    },
    yaml: {
      content: `
      connections:
        - name: myad-waad
          strategy: "waad"
          var: @@var@@
        - name: facebook
          strategy: "facebook"
          var: @@var@@
        - name: "##name##"
          strategy: "waad"
          options:
            tenant_domain: @@domain@@
            client_id: "my_client_id"
            client_secret: "my_secret"
            domain: somedomain.com
            waad_protocol: "openid-connect"
            api_enable_users: true
            basic_profile: true
            ext_profile: true
            ext_groups: true
        - name: "email"
          strategy: "email"
          var: @@var@@
          options:
            email:
              body: "./email.html"
        - name: "someSamlConnection"
          strategy: "samlp"
          enabled_clients:
            - "client1"
          options:
            passwordPolicy: "testPolicy"
            idpinitiated:
              client_id: "idp-one"
              client_protocol: samlp
              client_authorizequery: ""
      `,
      files: {
        'email.html': 'html code with ##secret##'
      }
    },
    expected: [
      { name: 'myad-waad', strategy: 'waad', var: 'something' },
      { name: 'facebook', strategy: 'facebook', var: 'something' },
      {
        name: 'test-waad',
        options: {
          api_enable_users: true,
          basic_profile: true,
          client_id: 'my_client_id',
          client_secret: 'my_secret',
          domain: 'somedomain.com',
          ext_groups: true,
          ext_profile: true,
          tenant_domain: 'mydomain.com',
          waad_protocol: 'openid-connect'
        },
        strategy: 'waad'
      },
      {
        name: 'someSamlConnection',
        strategy: 'samlp',
        enabled_clients: [ 'client1' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'idp-one',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      },
      {
        name: 'email',
        options: {
          email: {
            body: 'html code with test secret'
          }
        },
        strategy: 'email',
        var: 'something'
      }
    ]
  },
  export: {
    json: Object.keys(exampleConnections).map((key) => {
      const item = _.cloneDeep(exampleConnections[key]);
      if (item.name === 'someSamlConnection') {
        item.enabled_clients = [ 'client1-id' ];
        item.options.idpinitiated.client_id = 'client-idp-one-id';
      }
      return item;
    }),
    expected: {
      directory: {
        files: [
          ...Object.keys(exampleConnections).map((key) => {
            const item = updateExpected(exampleConnections[key]);
            if (item.name === 'someSamlConnection') {
              // FIXME: The implementation should be fixed to support conversion
              item.options.idpinitiated.client_id = 'client-idp-one-id';
            }
            return {
              fileName: key + '.json',
              contentType: 'json',
              content: item
            };
          }),
          {
            fileName: 'email.html',
            contentType: 'html',
            content: 'html code'
          }
        ]
      },
      yaml: {
        json: Object.values(exampleConnections).map(updateExpected),
        files: [
          {
            fileName: 'email.html',
            contentType: 'html',
            content: 'html code'
          }
        ]
      }
    }
  }
};
