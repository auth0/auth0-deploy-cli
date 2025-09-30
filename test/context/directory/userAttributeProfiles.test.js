import path from 'path';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';
import handler from '../../../src/context/directory/handlers/userAttributeProfiles';
import { loadJSON } from '../../../src/utils';

describe('#directory context userAttributeProfiles', () => {
  it('should process userAttributeProfiles', async () => {
    const files = {
      [constants.USER_ATTRIBUTE_PROFILES_DIRECTORY]: {
        'test-user-attribute-profile.json': `{
          "name": "test-user-attribute-profile",
          "user_attributes": {
            "email": {
              "description": "Email of the User",
              "label": "Email",
              "profile_required": true,
              "auth0_mapping": "email"
            }
          }
        }`,
        'test-user-attribute-profile-2.json': `{
          "name": "test-user-attribute-profile-2",
          "user_attributes": {
            "email": {
              "description": "Email of the User",
              "label": "Email",
              "profile_required": true,
              "auth0_mapping": "email",
              "saml_mapping": [
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
              ]
            }
          },
          "user_id": {
              "oidc_mapping": "sub"
          }
      }`,
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'userAttributeProfiles');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      { name: 'test-user-attribute-profile-2', user_attributes: { 'email': { auth0_mapping: 'email', description: 'Email of the User', label: 'Email', profile_required: true, saml_mapping: [ 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' ] } }, user_id: { oidc_mapping: 'sub' } } ,
      { name: 'test-user-attribute-profile', user_attributes: { 'email': { auth0_mapping: 'email', description: 'Email of the User', label: 'Email', profile_required: true } } } ,
    ];
    expect(context.assets.userAttributeProfiles).to.deep.equal(target);
  });

  it('should dump userAttributeProfiles', async () => {
    const dir = path.join(testDataDir, 'directory', 'userAttributeProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.userAttributeProfiles = [
      { name: 'test-user-attribute-profile-2', },
      { name: 'test-user-attribute-profile', description: 'test User Attribute Profile' },
    ];

    await handler.dump(context);
    const userAttributeProfilesFolder = path.join(dir, constants.USER_ATTRIBUTE_PROFILES_DIRECTORY);
    expect(
      loadJSON(path.join(userAttributeProfilesFolder, 'test-user-attribute-profile-2.json'))
    ).to.deep.equal(context.assets.userAttributeProfiles[0]);
    expect(
      loadJSON(path.join(userAttributeProfilesFolder, 'test-user-attribute-profile.json'))
    ).to.deep.equal(context.assets.userAttributeProfiles[1]);
  });
});
