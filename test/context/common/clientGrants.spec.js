import { constants } from 'auth0-source-control-extension-tools';

import dirHandler from '../../../src/context/directory/handlers/clientGrants';
import yamlHandler from '../../../src/context/yaml/handlers/clientGrants';

export default {
  handlerType: 'clientGrants',
  subDir: constants.CLIENTS_GRANTS_DIRECTORY,
  env: { AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' } },
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
  import: {
    directory: {
      files: {
        'test.json': `
    {
      "client_id": "auth0-webhooks",
      "audience": "https://test.auth0.com/api/v2/",
      "scope": [
        "read:logs"
      ],
      "var": @@var@@
    }`
      }
    },
    yaml: {
      content: `
      clientGrants:
        - client_id: "auth0-webhooks"
          audience: "https://test.auth0.com/api/v2/"
          scope:
            - "read:logs"
          var: @@var@@
      `
    },
    expected: [
      {
        audience: 'https://test.auth0.com/api/v2/',
        client_id: 'auth0-webhooks',
        scope: [ 'read:logs' ],
        var: 'something'
      }
    ]
  },
  export: {
    json: [
      {
        audience: 'https://test.myapp.com/api/v1',
        client_id: 'My M2M',
        scope: [ 'update:account' ]
      }
    ],
    expected: {
      directory: {
        files: [
          {
            fileName: 'My M2M (https---test.myapp.com-api-v1).json',
            contentType: 'json',
            content: {
              audience: 'https://test.myapp.com/api/v1',
              client_id: 'My M2M',
              scope: [ 'update:account' ]
            }
          }
        ]
      },
      yaml: {
        json: [
          {
            audience: 'https://test.myapp.com/api/v1',
            client_id: 'My M2M',
            scope: [ 'update:account' ]
          }
        ]
      }
    }
  }
};
