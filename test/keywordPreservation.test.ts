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
        { actions: 'actionName' }
      );

      expect(fieldsToPreserve).to.have.members([
        'tenant.friendly_name',
        'tenant.nested.nestedProperty',
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

    /* THE PROBLEM IS THAT PERIODS COULD BE IN THE ADDRESS VALUES */

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
        name: 'action-1-##ENV##',
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
        name: 'action-1 - Production',
        display_name: 'Production Action 1 - Production',
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
});
