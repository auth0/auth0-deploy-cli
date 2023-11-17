import { expect } from 'chai';
import { get as getDotNotation } from 'dot-prop';
import {
  doesHaveKeywordMarker,
  getPreservableFieldsFromAssets,
  getAssetsValueByAddress,
  convertAddressToDotNotation,
  updateAssetsByAddress,
  preserveKeywords,
} from '../src/keywordPreservation';
import { cloneDeep } from 'lodash';

describe('#Keyword Preservation', () => {
  describe('doesHaveKeywordMarker', () => {
    it('should return false when field does not contain keyword markers', () => {
      const keywordMappings = {
        BAR: 'bar',
      };
      expect(doesHaveKeywordMarker('', keywordMappings)).to.be.false;
      expect(doesHaveKeywordMarker('this is a field without a keyword marker', keywordMappings)).to
        .be.false;
      expect(doesHaveKeywordMarker('this field has an invalid @keyword@ marker', keywordMappings))
        .to.be.false;
    });

    it('should return false when field contain keyword markers but are absent in keyword mappings', () => {
      const keywordMappings = {
        BAR: 'bar',
      };
      expect(doesHaveKeywordMarker('##FOO##', keywordMappings)).to.be.false;
      expect(doesHaveKeywordMarker('@@FOO@@', keywordMappings)).to.be.false;
      expect(doesHaveKeywordMarker('this field has a @@FOO@@ marker', keywordMappings)).to.be.false;
    });

    it('should return true when field contain keyword markers that exist in keyword mappings', () => {
      const keywordMappings = {
        FOO: 'foo keyword',
        BAR: 'bar keyword',
        ARRAY: ['foo', 'bar'],
      };
      expect(doesHaveKeywordMarker('##FOO##', keywordMappings)).to.be.true;
      expect(doesHaveKeywordMarker('@@FOO@@', keywordMappings)).to.be.true;
      expect(doesHaveKeywordMarker('this field has a ##FOO## marker', keywordMappings)).to.be.true;
      expect(
        doesHaveKeywordMarker('this field has both a ##FOO## and ##BAR## marker', keywordMappings)
      ).to.be.true;
    });
  });

  describe('getPreservableFieldsFromAssets', () => {
    it('should retrieve all preservable fields from assets tree', () => {
      const fieldsToPreserve = getPreservableFieldsFromAssets(
        {
          tenant: {
            friendly_name: 'Friendly name ##KEYWORD##',
            notInKeywordMapping: '##NOT_IN_KEYWORD_MAPPING##',
            number: 5,
            boolean: true,
            nested: {
              nestedProperty: 'Nested property ##KEYWORD##',
            },
            nestedArray: [
              {
                name: 'nested-array-item-1',
                value:
                  "Even with ##KEYWORD##, this won't get preserved because this nested array item does not have a registered resource identifier",
              },
            ],
          },
          clientGrants: [
            {
              client_id: 'client-id',
              audience: '##KEYWORD##',
              name: 'Client grant name',
            },
            {
              client_id: 'another-client-id',
              audience: '##KEYWORD##',
              name: 'Another client grant name',
            },
            {
              client_id: '##KEYWORD##',
              audience: 'https://api.travel0.com',
              name: 'Client grant name',
            },
          ],
          actions: [
            {
              actionName: 'action-1',
              value: 'Action 1 ##KEYWORD##',
              notInKeywordMapping: '##NOT_IN_KEYWORD_MAPPING##',
            },
            {
              actionName: 'action-2',
              value: 'Action 2 ##KEYWORD##',
            },
          ],
          arrayReplace: '@@ARRAY_REPLACE_KEYWORD@@',
          nullField: null,
          undefinedField: undefined,
        },
        {
          KEYWORD: 'Travel0',
          ARRAY_REPLACE_KEYWORD: ['this value', 'that value'],
        },
        { actions: 'actionName', clientGrants: ['audience', 'client_id'] }
      );

      expect(fieldsToPreserve).to.have.members([
        'tenant.friendly_name',
        'tenant.nested.nestedProperty',
        'clientGrants.[audience=##KEYWORD##||client_id=client-id].audience',
        'clientGrants.[audience=##KEYWORD##||client_id=another-client-id].audience',
        'clientGrants.[audience=https://api.travel0.com||client_id=##KEYWORD##].client_id',
        'actions.[actionName=action-1].value',
        'actions.[actionName=action-2].value',
        'arrayReplace',
      ]);
    });
  });
});

describe('getAssetsValueByAddress', () => {
  it('should find the value of the addressed property', () => {
    const mockAssetTree = {
      tenant: {
        display_name: 'This is my tenant display name',
      },
      resourceServers: [
        {
          identifier: 'https://travel0.com/api/v1',
          name: 'API Main',
        },
        {
          identifier: '##API_MAIN_IDENTIFIER##',
          name: 'API Main',
        },
      ],
      clients: [
        {
          name: 'client-1',
          display_name: 'Some Display Name',
        },
        {
          name: 'client-2',
          display_name: 'This is the target value',
        },
        {
          name: 'client-3',
          connections: [
            {
              connection_name: 'connection-1',
              display_name: 'My connection display name',
            },
          ],
        },
      ],
    };

    expect(getAssetsValueByAddress('tenant.display_name', mockAssetTree)).to.equal(
      'This is my tenant display name'
    );
    expect(getAssetsValueByAddress('clients.[name=client-2].display_name', mockAssetTree)).to.equal(
      'This is the target value'
    );
    expect(
      getAssetsValueByAddress(
        'clients.[name=client-3].connections.[connection_name=connection-1].display_name',
        mockAssetTree
      )
    ).to.equal('My connection display name');
    expect(getAssetsValueByAddress('this.address.should.not.exist', mockAssetTree)).to.equal(
      undefined
    );
    expect(getAssetsValueByAddress('this.address.[should=not].exist', mockAssetTree)).to.equal(
      undefined
    );
    expect(getAssetsValueByAddress('this.address.should.[not=exist]', mockAssetTree)).to.equal(
      undefined
    );
    expect(
      getAssetsValueByAddress(
        'resourceServers.[identifier=##API_MAIN_IDENTIFIER##].identifier',
        mockAssetTree
      )
    ).to.equal('##API_MAIN_IDENTIFIER##');
    expect(
      getAssetsValueByAddress(
        'resourceServers.[identifier=https://travel0.com/api/v1].identifier',
        mockAssetTree
      )
    ).to.equal('https://travel0.com/api/v1');
  });

  it('should find the value of the addressed property for multi-part identifiers', () => {
    const mockAssetTree = {
      clientGrants: [
        {
          client_id: 'client-1',
          audience: 'audience-1',
          name: 'Client 1, Audience 1',
        },
        {
          client_id: 'client-1',
          audience: 'audience-2',
          name: 'Client 1, Audience 2',
        },
        {
          client_id: 'client-2',
          audience: 'audience-2',
          name: 'Client 2, Audience 2',
        },
        {
          client_id: 'client-2',
          audience: 'audience-1',
          name: 'Client 2, Audience 1',
        },
      ],
    };
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-1].name',
        mockAssetTree
      )
    ).to.equal('Client 1, Audience 1');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-2].name',
        mockAssetTree
      )
    ).to.equal('Client 1, Audience 2');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-2||audience=audience-1].name',
        mockAssetTree
      )
    ).to.equal('Client 2, Audience 1');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-2||audience=audience-2].name',
        mockAssetTree
      )
    ).to.equal('Client 2, Audience 2');

    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-1].audience',
        mockAssetTree
      )
    ).to.equal('audience-1');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-2].audience',
        mockAssetTree
      )
    ).to.equal('audience-2');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-1].client_id',
        mockAssetTree
      )
    ).to.equal('client-1');
    expect(
      getAssetsValueByAddress(
        'clientGrants.[client_id=client-1||audience=audience-2].client_id',
        mockAssetTree
      )
    ).to.equal('client-1');
  });

  it('should handle a non-array assets value', () => {
    [null, undefined, {}, false, 0, 'foo'].forEach((value) => {
      expect(() => getAssetsValueByAddress('tenant.display_name', value)).to.not.throw();
      expect(() =>
        getAssetsValueByAddress('clientGrants.[client_id=foo]display_name', value)
      ).to.not.throw();
      expect(() =>
        getAssetsValueByAddress('clientGrants.[client_id=##KEYWORD##]display_name', value)
      ).to.not.throw();
    });
  });
});

describe('convertAddressToDotNotation', () => {
  const mockAssets = {
    tenant: {
      friendly_name: 'Friendly Tenant Name',
    },
    actions: [
      {
        name: 'action-1',
        code: "window.alert('Foo')",
      },
      {
        name: 'action-2',
        nestedProperty: {
          array: [
            {
              name: 'foo',
            },
            {
              name: 'bar',
              arrayProperty: 'baz',
            },
          ],
        },
      },
    ],
  };

  it('should convert proprietary address to conventional JS object notation (aka "dot notation")', () => {
    expect(convertAddressToDotNotation(mockAssets, 'tenant.friendly_name')).to.equal(
      'tenant.friendly_name'
    );
    expect(getDotNotation(mockAssets, 'tenant.friendly_name')).to.equal(
      mockAssets.tenant.friendly_name
    );

    expect(convertAddressToDotNotation(mockAssets, 'actions.[name=action-1].code')).to.equal(
      'actions.0.code'
    );
    expect(getDotNotation(mockAssets, 'actions.0.code')).to.equal(mockAssets.actions[0].code);

    expect(
      convertAddressToDotNotation(
        mockAssets,
        'actions.[name=action-2].nestedProperty.array.[name=bar].arrayProperty'
      )
    ).to.equal('actions.1.nestedProperty.array.1.arrayProperty');

    expect(getDotNotation(mockAssets, 'actions.1.nestedProperty.array.1.arrayProperty')).to.equal(
      mockAssets.actions[1].nestedProperty?.array[1].arrayProperty
    );
  });

  it('should return null if provided address is invalid', () => {
    expect(
      convertAddressToDotNotation(mockAssets, 'actions.[name=this-action-does-not-exist].code')
    ).to.be.null;
  });
});

describe('updateAssetsByAddress', () => {
  const mockAssetTree = {
    tenant: {
      display_name: 'This is my tenant display name',
    },
    clients: [
      {
        name: 'client-1',
        display_name: 'Some Display Name',
      },
      {
        name: 'client-2',
        display_name: 'This is the target value',
      },
      {
        name: 'client-3',
        connections: [
          {
            connection_name: 'connection-1',
            display_name: 'My connection display name',
          },
        ],
      },
    ],
  };
  it('should update an specific asset field for a provided address', () => {
    expect(
      updateAssetsByAddress(
        mockAssetTree,
        'clients.[name=client-3].connections.[connection_name=connection-1].display_name',
        'New connection display name'
      )
    ).to.deep.equal(
      (() => {
        const newAssets = mockAssetTree;
        //@ts-ignore because we know this value is defined
        newAssets.clients[2].connections[0].display_name = 'New connection display name';
        return newAssets;
      })()
    );

    expect(
      updateAssetsByAddress(mockAssetTree, 'tenant.display_name', 'This is the new display name')
    ).to.deep.equal(
      (() => {
        const newAssets = mockAssetTree;
        newAssets.tenant.display_name = 'This is the new display name';
        return newAssets;
      })()
    );
  });

  it('should return unaltered assets tree if non-existent address provided', () => {
    expect(
      updateAssetsByAddress(mockAssetTree, 'clients.[name=this-client-does-not-exist]', '_')
    ).to.deep.equal(mockAssetTree);

    expect(
      updateAssetsByAddress(mockAssetTree, 'tenant.this_property_does_not_exist', '_')
    ).to.deep.equal(mockAssetTree);
  });

  it('should update assets tree if identifier field is updated', () => {
    expect(
      updateAssetsByAddress(
        {
          actions: [
            {
              name: 'action-1-##ENV##',
              display_name: '##ENV## Action 1',
            },
          ],
        },
        'actions.[name=action-1-##ENV##].name',
        'action-1-dev'
      )
    ).to.deep.equal({
      actions: [
        {
          name: 'action-1-dev',
          display_name: '##ENV## Action 1',
        },
      ],
    });
    expect(
      updateAssetsByAddress(
        {
          actions: [
            {
              name: 'action-1-dev',
              display_name: '##ENV## Action 1',
            },
          ],
        },
        'actions.[name=action-1-dev].name',
        'action-1-dev'
      )
    ).to.deep.equal({
      actions: [
        {
          name: 'action-1-dev',
          display_name: '##ENV## Action 1',
        },
      ],
    });
  });
});

describe('preserveKeywords', () => {
  const mockLocalAssets = {
    tenant: {
      display_name: 'The ##COMPANY_NAME## Tenant',
      allowed_logout_urls: '@@ALLOWED_LOGOUT_URLS@@',
    },
    roles: null,
    hooks: undefined,
    connections: [
      {
        name: 'connection-1',
        type: 'waad',
        options: {
          domain: '##COMPANY_NAME##.com',
        },
      },
    ],
    emailTemplates: [
      {
        template: 'welcome',
        body: '<html>Welcome to ##ENV## ##COMPANY_NAME## Tenant</html>',
      },
    ],
    actions: [
      {
        name: 'action-1',
        display_name: '##ENV## Action 1',
      },
      {
        name: 'action-2',
        display_name: "This action won't exist on remote, will be deleted",
      },
    ],
    resourceServers: [
      {
        name: 'api-main',
        identifier: '##API_MAIN_IDENTIFIER##',
      },
    ],
    customDomains: [
      {
        domain: '##COMPANY_NAME##.com',
        primary: true,
        status: 'ready',
      },
    ],
    guardianFactorProviders: [
      {
        name: 'sms',
        auth_token: '##AUTH_TOKEN##',
        from: '##COMPANY_NAME##',
        sid: '##TWILIO_SID##',
        messaging_service_sid: '##TWILIO_SID##',
        provider: 'twilio',
      },
    ],
  };

  const mockRemoteAssets = {
    tenant: {
      display_name: 'The Travel0 Tenant',
      allowed_logout_urls: ['localhost:3000/logout', 'https://travel0.com/logout'],
    },
    prompts: {
      universal_login_enabled: true,
      customText: {},
    },
    pages: undefined, //TODO: test these cases more thoroughly
    rules: null, //TODO: test these cases more thoroughly
    connections: [], // Empty on remote but has local assets
    actions: [
      {
        name: 'action-1',
        display_name: 'Production Action 1',
      },
      {
        name: 'action-3',
        display_name: 'This action exists on remote but not local',
      },
    ],
    emailTemplates: [
      {
        template: 'welcome',
        body: '<html>Welcome to Production Travel0 Tenant</html>',
      },
    ],
    resourceServers: [
      {
        name: 'api-main',
        identifier: 'https://travel0.com/api/v1',
      },
    ],
    customDomains: [
      {
        domain: 'Travel0.com',
        primary: true,
        status: 'ready',
      },
    ],
    guardianFactorProviders: [
      {
        name: 'sms',
        auth_token: 'mock-twilio-auth-token',
        from: 'travel0',
        sid: 'twilio-sid',
        messaging_service_sid: 'twilio-sid',
        provider: 'twilio',
      },
    ],
  };

  const auth0Handlers = [
    {
      id: 'id',
      identifiers: ['id', 'name'],
      type: 'actions',
    },
    {
      id: 'id',
      identifiers: ['id', 'name'],
      type: 'connections',
    },
    {
      id: 'id',
      identifiers: ['template'],
      type: 'emailTemplates',
    },
    {
      id: 'id',
      identifiers: ['id', 'identifier'],
      type: 'resourceServers',
    },
    { id: 'id', identifiers: ['id', 'domain'], type: 'customDomains' },
    { id: 'id', identifiers: ['name'], type: 'guardianFactorProviders' },
  ];

  it('should preserve keywords when they correlate to keyword mappings', () => {
    const preservedAssets = preserveKeywords({
      localAssets: mockLocalAssets,
      remoteAssets: mockRemoteAssets,
      keywordMappings: {
        COMPANY_NAME: 'Travel0',
        ALLOWED_LOGOUT_URLS: ['localhost:3000/logout', 'https://travel0.com/logout'],
        ENV: 'Production',
        API_MAIN_IDENTIFIER: 'https://travel0.com/api/v1',
        AUTH_TOKEN: 'mock-twilio-auth-token',
        TWILIO_SID: 'twilio-sid',
      },
      auth0Handlers,
    });

    expect(preservedAssets).to.deep.equal(
      (() => {
        const expected = cloneDeep(mockRemoteAssets);
        //@ts-ignore
        expected.tenant = mockLocalAssets.tenant;
        expected.actions[0].display_name = '##ENV## Action 1';
        expected.emailTemplates[0].body = '<html>Welcome to ##ENV## ##COMPANY_NAME## Tenant</html>';
        expected.resourceServers = [
          {
            name: 'api-main',
            identifier: '##API_MAIN_IDENTIFIER##',
          },
        ];
        expected.customDomains[0].domain = '##COMPANY_NAME##.com';
        expected.guardianFactorProviders[0].sid = '##TWILIO_SID##';
        expected.guardianFactorProviders[0].messaging_service_sid = '##TWILIO_SID##';
        expected.guardianFactorProviders[0].auth_token = '##AUTH_TOKEN##';
        expected.guardianFactorProviders[0].from = '##COMPANY_NAME##';
        return expected;
      })()
    );
  });

  it('should not preserve keywords when no keyword mappings', () => {
    const preservedAssets = preserveKeywords({
      localAssets: mockLocalAssets,
      remoteAssets: mockRemoteAssets,
      keywordMappings: {},
      auth0Handlers,
    });
    expect(preservedAssets).to.deep.equal(mockRemoteAssets);
  });

  it('should preserve keywords in identifier fields', () => {
    const mockLocalAssets = {
      connections: [
        {
          name: '##ENV##-connection-1',
          type: 'waad',
          options: {
            domain: '##ENV##.travel0.com',
          },
        },
      ],
      actions: [
        {
          name: 'action-1-##ENV##',
          display_name: '##ENV## Action 1',
        },
        {
          name: 'action-2-##ENV##',
          display_name: "This action won't exist on remote, will be deleted",
        },
      ],
      resourceServers: [
        {
          name: 'api-main',
          identifier: 'https://##ENV##.travel0.com/api/v1',
        },
      ],
    };

    const preservedAssets = preserveKeywords({
      localAssets: mockLocalAssets,
      remoteAssets: {
        connections: [
          {
            name: 'dev-connection-1',
            type: 'waad',
            options: {
              domain: 'dev.travel0.com',
            },
          },
        ],
        actions: [
          {
            name: 'action-1-dev',
            display_name: 'dev Action 1',
          },
        ],
        resourceServers: [
          {
            name: 'api-main',
            identifier: 'https://dev.travel0.com/api/v1',
          },
        ],
      },
      keywordMappings: {
        ENV: 'dev',
      },
      auth0Handlers: [
        {
          id: 'id',
          identifiers: ['id', 'name'],
          type: 'actions',
        },
        {
          id: 'id',
          identifiers: ['id', 'name'],
          type: 'connections',
        },
        {
          id: 'id',
          identifiers: ['id', 'identifier'],
          type: 'resourceServers',
        },
      ],
    });

    const expected = (() => {
      let expected = mockLocalAssets;
      expected.actions = [mockLocalAssets.actions[0]];
      return expected;
    })();

    expect(preservedAssets).to.deep.equal(expected);
  });

  it('should preserve keywords in identifier fields for resources with multiple identifiers', () => {
    const mockLocalAssets = {
      clientGrants: [
        {
          client_id: 'API Explorer Application',
          audience: 'https://##ENV##.travel0.com/api/v1',
          scope: ['update:account'],
          name: 'API Explorer Application',
        },
        {
          client_id: 'M2M Application',
          audience: '##API_IDENTIFIER##',
          scope: ['create:users', 'read:users'],
          name: 'My M2M',
        },
        {
          client_id: 'M2M Application',
          audience: 'https://##ENV##.travel0.com/api/v1',
          scope: ['update:account'],
          name: 'My M2M',
        },
      ],
    };

    const preservedAssets = preserveKeywords({
      localAssets: mockLocalAssets,
      remoteAssets: {
        clientGrants: [
          {
            client_id: 'API Explorer Application',
            audience: 'https://dev.travel0.com/api/v1',
            scope: ['update:account'],
            name: 'API Explorer Application',
          },
          {
            client_id: 'M2M Application',
            audience: 'https://api.travel0.com/v1',
            scope: ['create:users', 'read:users'],
            name: 'My M2M',
          },
          {
            client_id: 'M2M Application',
            audience: 'https://dev.travel0.com/api/v1',
            scope: ['update:account'],
            name: 'My M2M',
          },
        ],
      },
      keywordMappings: {
        ENV: 'dev',
        API_IDENTIFIER: 'https://api.travel0.com/v1',
      },
      auth0Handlers: [
        {
          type: 'clientGrants',
          id: 'id',
          identifiers: ['id', ['client_id', 'audience']],
        },
      ],
    });

    const expected = (() => {
      let expected = mockLocalAssets;
      return expected;
    })();

    expect(preservedAssets).to.deep.equal(expected);
  });

  it('should not preserve keywords in identifier fields if keyword value is different than on remote', () => {
    const mockLocalAssets = {
      connections: [
        {
          name: '##ENV##-connection-1',
          type: 'waad',
          options: {
            domain: '##ENV##.travel0.com',
          },
        },
      ],
      actions: [
        {
          name: 'action-1-##ENV##',
          display_name: '##ENV## Action 1',
        },
        {
          name: 'action-2-##ENV##',
          display_name: "This action won't exist on remote, will be deleted",
        },
      ],
      resourceServers: [
        {
          name: 'api-main',
          identifier: 'https://##ENV##.travel0.com/api/v1',
        },
      ],
    };

    const preservedAssets = preserveKeywords({
      localAssets: mockLocalAssets,
      remoteAssets: {
        connections: [
          {
            name: 'prod-connection-1',
            type: 'waad',
            options: {
              domain: 'prod.travel0.com',
            },
          },
        ],
        actions: [
          {
            name: 'action-1-prod', // Note: prod is different than keyword mapping value of dev
            display_name: 'prod Action 1',
          },
        ],
        resourceServers: [
          {
            name: 'api-main',
            identifier: 'https://prod.travel0.com/api/v1',
          },
        ],
      },
      keywordMappings: {
        ENV: 'dev', // Note: different than remote value of prod
      },
      auth0Handlers: [
        {
          id: 'id',
          identifiers: ['id', 'name'],
          type: 'actions',
        },
        {
          id: 'id',
          identifiers: ['id', 'name'],
          type: 'connections',
        },
        {
          id: 'id',
          identifiers: ['id', 'identifier'],
          type: 'resourceServers',
        },
      ],
    });

    expect(preservedAssets).to.deep.equal({
      connections: [
        {
          name: 'prod-connection-1',
          type: 'waad',
          options: {
            domain: 'prod.travel0.com',
          },
        },
      ],
      actions: [
        {
          name: 'action-1-prod',
          display_name: 'prod Action 1',
        },
      ],
      resourceServers: [
        {
          name: 'api-main',
          identifier: 'https://prod.travel0.com/api/v1',
        },
      ],
    });
  });

  it('should not throw if locally-preserved keyword is on a null remote asset', () => {
    const foo = preserveKeywords({
      remoteAssets: {
        connections: null,
      },
      localAssets: {
        connections: [
          {
            name: 'connection-1',
            someProperty: '##KEYWORD##',
          },
        ],
      },
      auth0Handlers,
      keywordMappings: {
        KEYWORD: 'example',
      },
    });

    expect(foo).to.deep.equal({
      connections: null,
    });
  });
});
