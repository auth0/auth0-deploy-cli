import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/userAttributeProfiles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context userAttributeProfiles', () => {
  it('should process userAttributeProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'userAttributeProfiles');
    cleanThenMkdir(dir);

    const yaml = `
    userAttributeProfiles:
      - name: test-user-attribute-profile
        description: test User Attribute Profile
        user_attributes:
          email:
            description: Email of the User
            label: Email
            profile_required: true
            auth0_mapping: email
      - name: test-user-attribute-profile-2
        description: test User Attribute new profile 2
        user_attributes:
          email:
            description: Email of the User
            label: Email
            profile_required: true
            auth0_mapping: email
            saml_mapping:
              - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier
              - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn
              - http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
        user_id:
          oidc_mapping: sub
            `;

    const target = [
      {
        name: 'test-user-attribute-profile',
        description: 'test User Attribute Profile',
        user_attributes: {
          email: {
            description: 'Email of the User',
            label: 'Email',
            profile_required: true,
            auth0_mapping: 'email',
          },
        },
      },
      {
        name: 'test-user-attribute-profile-2',
        description: 'test User Attribute new profile 2',
        user_attributes: {
          email: {
            description: 'Email of the User',
            label: 'Email',
            profile_required: true,
            auth0_mapping: 'email',
            saml_mapping: [
              'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
              'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
              'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
            ],
          },
        },
        user_id: {
          oidc_mapping: 'sub',
          scim_mapping: 'externalId',
        },
      },
    ];

    const yamlFile = path.join(dir, 'user-attribute-profiles1.yaml');
    const userAttributeProfilesPath = path.join(dir, 'userAttributeProfiles');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(userAttributeProfilesPath);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.userAttributeProfiles).to.deep.equal(target);
  });

  it('should dump userAttributeProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'userAttributeProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );
    const userAttributeProfiles = [
      {
        name: 'test-user-attribute-profile',
        description: 'test User Attribute Profile',
        user_attributes: [],
        user_id: {},
      },
    ];

    const target = [
      {
        name: 'test-user-attribute-profile',
        description: 'test User Attribute Profile',
        user_attributes: [],
        user_id: {},
      },
    ];

    context.assets.userAttributeProfiles = userAttributeProfiles;
    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ userAttributeProfiles: target });
  });
});
