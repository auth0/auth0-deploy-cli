import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/selfServiceProfiles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context selfServiceProfiles', () => {
  it('should process selfServiceProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'selfServiceProfiles1');
    cleanThenMkdir(dir);

    const yaml = `
    selfServiceProfiles:
      - name: test-self-service-profile
        allowed_strategies: @@ALLOWED_STRATEGIES@@
        branding:
          colors:
            primary: '#19aecc'
        customText:
          en:
            get-started:
              introduction: >-
                Welcome! With <p>only a few steps</p> you'll be able to setup your
                new connection.
        description: test Self-Service Profile
        user_attributes:
          - name: email
            description: Email of the User
            is_optional: false
          - name: name
            description: Name of the User
            is_optional: true
      - name: test-self-service-profile-2
        description: test self-Service new profile 2
    `;

    const target = [
      {
        name: 'test-self-service-profile',
        description: 'test Self-Service Profile',
        user_attributes: [
          {
            name: 'email',
            description: 'Email of the User',
            is_optional: false,
          },
          {
            name: 'name',
            description: 'Name of the User',
            is_optional: true,
          },
        ],
        allowed_strategies: [
          'adfs',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'samlp',
          'waad',
        ],
        branding: { colors: { primary: '#19aecc' } },
        customText: {
          en: {
            'get-started': {
              introduction:
                "Welcome! With <p>only a few steps</p> you'll be able to setup your new connection.",
            },
          },
        },
      },
      {
        name: 'test-self-service-profile-2',
        description: 'test self-Service new profile 2',
      },
    ];

    const yamlFile = path.join(dir, 'selfServiceProfiles.yaml');
    const selfServiceProfilesPath = path.join(dir, 'selfServiceProfiles');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(selfServiceProfilesPath);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        ALLOWED_STRATEGIES: [
          'adfs',
          'auth0-samlp',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'okta-samlp',
          'pingfederate',
          'samlp',
          'waad',
        ],
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.selfServiceProfiles).to.deep.equal(target);
  });

  it('should dump selfServiceProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'selfServiceProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );
    const selfServiceProfiles = [
      {
        name: 'test-self-service-profile',
        description: 'test Self-Service Profile',
        user_attributes: [
          {
            name: 'email',
            description: 'Email of the User',
            is_optional: false,
          },
          {
            name: 'name',
            description: 'Name of the User',
            is_optional: true,
          },
        ],
        allowed_strategies: [
          'adfs',
          'auth0-samlp',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'okta-samlp',
          'pingfederate',
          'samlp',
          'waad',
        ],
        branding: { colors: { primary: '#19aecc' } },
        customText: {
          en: {
            'get-started': {
              introduction:
                "Welcome! With <p>only a few steps</p> you'll be able to setup your new connection.",
            },
          },
        },
      },
      {
        name: 'test-self-service-profile-2',
        description: 'test self-Service new profile 2',
      },
    ];

    const target = [
      {
        name: 'test-self-service-profile',
        description: 'test Self-Service Profile',
        user_attributes: [
          {
            name: 'email',
            description: 'Email of the User',
            is_optional: false,
          },
          {
            name: 'name',
            description: 'Name of the User',
            is_optional: true,
          },
        ],
        allowed_strategies: [
          'adfs',
          'auth0-samlp',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'okta-samlp',
          'pingfederate',
          'samlp',
          'waad',
        ],
        branding: { colors: { primary: '#19aecc' } },
        customText: {
          en: {
            'get-started': {
              introduction:
                "Welcome! With <p>only a few steps</p> you'll be able to setup your new connection.",
            },
          },
        },
      },
      {
        name: 'test-self-service-profile-2',
        description: 'test self-Service new profile 2',
      },
    ];

    context.assets.selfServiceProfiles = selfServiceProfiles;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ selfServiceProfiles: target });
  });

  it('should dump selfServiceProfiles and convert user_attribute_profile_id to names on dump', async () => {
    const dir = path.join(testDataDir, 'yaml', 'selfServiceProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );
    const selfServiceProfiles = [
      {
        name: 'test-self-service-profile',
        description: 'test Self-Service Profile',
        allowed_strategies: [
          'adfs',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'samlp',
          'waad',
        ],
        branding: { colors: { primary: '#19aecc' } },
        customText: {
          en: {
            'get-started': {
              introduction:
                "Welcome! With <p>only a few steps</p> you'll be able to setup your new connection.",
            },
          },
        },
        user_attribute_profile_id: 'uap_12345',
      },
    ];

    const target = [
      {
        name: 'test-self-service-profile',
        description: 'test Self-Service Profile',
        allowed_strategies: [
          'adfs',
          'google-apps',
          'keycloak-samlp',
          'oidc',
          'okta',
          'samlp',
          'waad',
        ],
        branding: { colors: { primary: '#19aecc' } },
        customText: {
          en: {
            'get-started': {
              introduction:
                "Welcome! With <p>only a few steps</p> you'll be able to setup your new connection.",
            },
          },
        },
        user_attribute_profile_id: 'profile1',
      },
    ];

    context.assets.selfServiceProfiles = selfServiceProfiles;
    context.assets.userAttributeProfiles = [{ id: 'uap_12345', name: 'profile1' }];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ selfServiceProfiles: target });
  });
});
