import _ from 'lodash';
import { constants } from 'auth0-source-control-extension-tools';

import dirHandler from '../../../src/context/directory/handlers/clients';
import yamlHandler from '../../../src/context/yaml/handlers/clients';

const exampleClients = {
  customLoginClient: { app_type: 'spa', name: 'customLoginClient', custom_login_page: 'html code' },
  someClient: { app_type: 'spa', name: 'someClient' },
  someClient2: { app_type: 'spa', name: 'someClient2' },
  'someClient-test': {
    app_type: 'spa',
    name: 'someClient-test'
  },
  'someClient2-aa': {
    app_type: 'spa',
    name: 'someClient2/aa'
  }
};

function updateExpected(item) {
  const result = _.cloneDeep(item);
  if (result.name === 'customLoginClient') {
    result.custom_login_page = './customLoginClient_custom_login_page.html';
  }
  return result;
}

export default {
  handlerType: 'clients',
  subDir: constants.CLIENTS_DIRECTORY,
  env: { AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' } },
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
        'someClient.json': '{ "app_type": @@appType@@, "name": "someClient" }',
        'someClient2.json': '{ "app_type": @@appType@@, "name": "someClient2" }',
        'customLoginClient.json': '{ "app_type": @@appType@@, "name": "customLoginClient", "custom_login_page": "./customLoginClient_custom_login_page.html" }',
        'customLoginClient_custom_login_page.html': 'html code'
      }
    },
    yaml: {
      content: `
      clients:
        -
          name: "someClient"
          app_type: @@appType@@
        -
          name: "someClient2"
          app_type: "##appType##"
        -
          name: "customLoginClient"
          app_type: "##appType##"
          custom_login_page: "./customLoginClient_custom_login_page.html"
      `,
      files: {
        'customLoginClient_custom_login_page.html': 'html code'
      }
    },
    expected: Object.keys(exampleClients).slice(0, 3).map(key => exampleClients[key])
  },
  export: {
    json: Object.values(exampleClients),
    expected: {
      directory: {
        files: [
          ...Object.keys(exampleClients)
            .map(key => ({
              fileName: key + '.json',
              contentType: 'json',
              content: updateExpected(exampleClients[key])
            })),
          {
            fileName: 'customLoginClient_custom_login_page.html',
            contentType: 'html',
            content: 'html code'
          }
        ]
      },
      yaml: {
        json: Object.values(exampleClients).map(updateExpected),
        files: [
          {
            fileName: 'customLoginClient_custom_login_page.html',
            contentType: 'html',
            content: 'html code'
          }
        ]
      }
    }
  }
};
