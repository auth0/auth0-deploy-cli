import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import promptsHandler from '../../../src/context/directory/handlers/prompts';
import { getFiles, loadJSON } from '../../../src/utils';
import {
  cleanThenMkdir,
  testDataDir,
  createDir,
  mockMgmtClient,
  createDirWithNestedDir,
} from '../../utils';

const dir = path.join(testDataDir, 'directory', 'promptsDump');
const promptsDirectory = path.join(dir, constants.PROMPTS_DIRECTORY);
const promptsScreenSettingsDirectory = path.join(
  promptsDirectory,
  constants.PROMPTS_SCREEN_RENDER_DIRECTORY
);

const promptsSettingsFile = 'prompts.json';
const customTextFile = 'custom-text.json';
const partialsFile = 'partials.json';
const signupIdSettingsFile = 'signup-id_signup-id.json';
const loginIdSettingsFile = 'login-id_login-id.json';

describe('#directory context prompts', () => {
  it('should parse prompts', async () => {
    const files = {
      [constants.PROMPTS_DIRECTORY]: {
        [promptsSettingsFile]: JSON.stringify({
          universal_login_experience: 'classic',
          identifier_first: true,
        }),
        [customTextFile]: JSON.stringify({
          en: {
            login: {
              login: {
                buttonText: '##BUTTON_TEXT_ENGLISH##',
                description: 'english login description text',
              },
            },
            'signup-password': {
              'signup-password': {
                buttonText: '##BUTTON_TEXT_ENGLISH##',
                description: 'english signup password description text',
              },
            },
          },
          fr: {
            login: {
              login: {
                buttonText: '##BUTTON_TEXT_FRENCH##',
                description: 'french login description text',
              },
            },
          },
        }),
        [partialsFile]: JSON.stringify({
          login: [
            {
              login: [
                {
                  name: 'form-content-start',
                  template: 'partials/login/login/form-content-start.liquid',
                },
              ],
            },
          ],
          signup: [
            {
              signup: [
                {
                  name: 'form-content-end',
                  template: 'partials/signup/signup/form-content-end.liquid',
                },
              ],
            },
          ],
        }),
      },
    };

    const settingsfiles = {
      [constants.PROMPTS_SCREEN_RENDER_DIRECTORY]: {
        [signupIdSettingsFile]: JSON.stringify({
          prompt: 'signup-id',
          screen: 'signup-id',
          rendering_mode: 'standard',
          context_configuration: [],
          default_head_tags_disabled: false,
          head_tags: [
            {
              tag: 'script',
              attributes: {
                src: 'URL_TO_YOUR_ASSET',
                async: true,
                defer: true,
                integrity: ['ASSET_SHA'],
              },
            },
          ],
        }),
        [loginIdSettingsFile]: JSON.stringify({
          prompt: 'login-id',
          screen: 'login-id',
          rendering_mode: 'advanced',
          context_configuration: [],
          default_head_tags_disabled: false,
          head_tags: [
            {
              tag: 'script',
              attributes: {
                src: 'http://127.0.0.1:8080/index.js',
                defer: true,
              },
            },
            {
              tag: 'link',
              attributes: {
                rel: 'stylesheet',
                href: 'http://127.0.0.1:8090/index.css',
              },
            },
            {
              tag: 'meta',
              attributes: {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
              },
            },
          ],
        }),
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'prompts');
    createDir(repoDir, files);

    const settingsDir = path.join(
      repoDir,
      constants.PROMPTS_DIRECTORY,
      constants.PROMPTS_SCREEN_RENDER_DIRECTORY
    );
    createDir(settingsDir, settingsfiles);

    const partialsDir = path.join(
      repoDir,
      constants.PROMPTS_DIRECTORY,
      constants.PARTIALS_DIRECTORY
    );

    const partialsFiles = {
      login: {
        login: {
          'form-content-start.liquid': '<div>TEST</div>',
        },
      },
      signup: {
        signup: {
          'form-content-end.liquid': '<div>TEST AGAIN</div>',
        },
      },
    };

    createDirWithNestedDir(partialsDir, partialsFiles);

    const screenSettingsDir = path.join(
      repoDir,
      constants.PROMPTS_DIRECTORY,
      constants.PROMPTS_SCREEN_RENDER_DIRECTORY
    );

    const signupIdSettingsFiles = {
      'signup-id_signup-id.json':
        '{ "prompt": "signup-id", "screen": "signup-id", "rendering_mode": "advanced","default_head_tags_disabled": false,' +
        '"context_configuration": [ "branding.settings", "branding.themes.default"],  "head_tags": [{"attributes": {"async": true,  "defer": true , ' +
        '"integrity": ["sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g=="], "src": "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"}, "tag": "script"}]}',
      'login-id_login-id.json':
        '{ "prompt": "login-id", "screen": "login-id", "rendering_mode": "standard", "context_configuration": [],"default_head_tags_disabled": false}',
    };

    createDir(repoDir, { [screenSettingsDir]: signupIdSettingsFiles });

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        BUTTON_TEXT_FRENCH: 'French button text',
        BUTTON_TEXT_ENGLISH: 'English button text',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.prompts).to.deep.equal({
      universal_login_experience: 'classic',
      identifier_first: true,
      partials: {
        login: {
          login: {
            'form-content-start': '<div>TEST</div>',
          },
        },
        signup: {
          signup: {
            'form-content-end': '<div>TEST AGAIN</div>',
          },
        },
      },
      customText: {
        en: {
          login: {
            login: {
              buttonText: `${config.AUTH0_KEYWORD_REPLACE_MAPPINGS.BUTTON_TEXT_ENGLISH}`,
              description: 'english login description text',
            },
          },
          'signup-password': {
            'signup-password': {
              buttonText: `${config.AUTH0_KEYWORD_REPLACE_MAPPINGS.BUTTON_TEXT_ENGLISH}`,
              description: 'english signup password description text',
            },
          },
        },
        fr: {
          login: {
            login: {
              buttonText: `${config.AUTH0_KEYWORD_REPLACE_MAPPINGS.BUTTON_TEXT_FRENCH}`,
              description: 'french login description text',
            },
          },
        },
      },
      screenRenderers: [
        {
          prompt: 'login-id',
          screen: 'login-id',
          rendering_mode: 'standard',
          context_configuration: [],
          default_head_tags_disabled: false,
        },
        {
          prompt: 'signup-id',
          screen: 'signup-id',
          rendering_mode: 'advanced',
          context_configuration: ['branding.settings', 'branding.themes.default'],
          default_head_tags_disabled: false,
          head_tags: [
            {
              tag: 'script',
              attributes: {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
                async: true,
                defer: true,
                integrity: [
                  'sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==',
                ],
              },
            },
          ],
        },
      ],
    });
  });

  it('should replace keywords', async () => {
    const files = {
      [constants.PROMPTS_DIRECTORY]: {
        [promptsSettingsFile]: JSON.stringify({
          universal_login_experience: 'classic',
          identifier_first: true,
        }),
        [customTextFile]: JSON.stringify({
          en: {
            login: {
              login: {
                buttonText: 'Hello, ##SOME_REPLACED_LITERAL##!',
                description: 'english login description text',
              },
            },
          },
        }),
        [partialsFile]: JSON.stringify({
          login: [
            {
              login: [
                {
                  name: 'form-content-start',
                  template: 'partials/login/login/form-content-start.liquid',
                },
              ],
            },
          ],
          signup: [
            {
              signup: [
                {
                  name: 'form-content-end',
                  template: 'partials/signup/signup/form-content-end.liquid',
                },
              ],
            },
          ],
        }),
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'prompts');
    createDir(repoDir, files);

    const partialsDir = path.join(
      repoDir,
      constants.PROMPTS_DIRECTORY,
      constants.PARTIALS_DIRECTORY
    );

    const partialsFiles = {
      login: {
        login: {
          'form-content-start.liquid': '<p>Hello, ##SOME_REPLACED_LITERAL##!</p>',
        },
      },
      signup: {
        signup: {
          'form-content-end.liquid': '<script>const someArray = @@SOME_REPLACED_ARRAY@@;</script>',
        },
      },
    };

    createDirWithNestedDir(partialsDir, partialsFiles);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        SOME_REPLACED_LITERAL: 'world',
        SOME_REPLACED_ARRAY: ['foo', 'bar', 'baz'],
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.prompts).to.deep.equal({
      universal_login_experience: 'classic',
      identifier_first: true,
      partials: {
        login: {
          login: {
            'form-content-start': '<p>Hello, world!</p>',
          },
        },
        signup: {
          signup: {
            'form-content-end': '<script>const someArray = ["foo","bar","baz"];</script>',
          },
        },
      },
      customText: {
        en: {
          login: {
            login: {
              buttonText: 'Hello, world!',
              description: 'english login description text',
            },
          },
        },
      },
      screenRenderers: [],
    });
  });

  describe('should parse prompts even if one or both files are absent', async () => {
    it('should parse prompts even if one or more files are absent', async () => {
      cleanThenMkdir(promptsDirectory);
      const mockPromptsSettings = {
        universal_login_experience: 'classic',
        identifier_first: true,
      };
      const promptsDirectoryNoCustomTextFile = {
        [constants.PROMPTS_DIRECTORY]: {
          [promptsSettingsFile]: JSON.stringify(mockPromptsSettings),
          [partialsFile]: JSON.stringify({}),
        },
      };

      createDir(promptsDirectory, promptsDirectoryNoCustomTextFile);

      const config = {
        AUTH0_INPUT_FILE: promptsDirectory,
      };
      const context = new Context(config, mockMgmtClient());
      await context.loadAssetsFromLocal();
      expect(context.assets.prompts).to.deep.equal({
        ...mockPromptsSettings,
        customText: {},
        partials: {},
        screenRenderers: [],
      });
    });

    it('should parse even if custom prompts file is absent', async () => {
      cleanThenMkdir(promptsDirectory);
      const mockPromptsSettings = {
        universal_login_experience: 'classic',
        identifier_first: true,
      };
      const promptsDirectoryNoPartialsFile = {
        [constants.PROMPTS_DIRECTORY]: {
          [promptsSettingsFile]: JSON.stringify(mockPromptsSettings),
          [customTextFile]: JSON.stringify({}),
        },
      };

      createDir(promptsDirectory, promptsDirectoryNoPartialsFile);

      const config = {
        AUTH0_INPUT_FILE: promptsDirectory,
      };
      const context = new Context(config, mockMgmtClient());
      await context.loadAssetsFromLocal();

      expect(context.assets.prompts).to.deep.equal({
        ...mockPromptsSettings,
        customText: {},
        partials: {},
        screenRenderers: [],
      });
    });

    it('should parse even if both files are absent', async () => {
      cleanThenMkdir(promptsDirectory);
      const emptyPromptsDirectory = {
        [constants.PROMPTS_DIRECTORY]: {},
      };

      createDir(promptsDirectory, emptyPromptsDirectory);

      const config = {
        AUTH0_INPUT_FILE: promptsDirectory,
      };
      const context = new Context(config, mockMgmtClient());
      await context.loadAssetsFromLocal();

      expect(context.assets.prompts).to.deep.equal({
        customText: {},
        partials: {},
        screenRenderers: [],
      });
    });
  });

  it('should not dump prompts settings and prompts custom text when prompts object is null', async () => {
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });
    context.assets.prompts = null;

    promptsHandler.dump(context);
    const dumpedFiles = getFiles(promptsDirectory, ['.json']);

    expect(dumpedFiles).to.have.length(0);
  });

  it('should not dump prompts settings and prompts custom text when prompts object is undefined', async () => {
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });

    promptsHandler.dump(context);
    const dumpedFiles = getFiles(promptsDirectory, ['.json']);

    expect(dumpedFiles).to.have.length(0);
  });

  it('should dump prompts settings, prompts custom text when API responses are empty and screen renderers', async () => {
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });

    context.assets.prompts = {
      universal_login_experience: 'classic',
      identifier_first: true,
      customText: {
        en: {
          login: {
            login: {
              buttonText: 'English login button text',
              description: 'English login description',
            },
          },
        },
        fr: {
          login: {
            login: {
              buttonText: 'French login button text',
              description: 'French login description',
            },
          },
        },
      },
      partials: {
        login: {
          login: {
            'form-content-start': '<div>TEST</div>',
          },
        },
        signup: {
          signup: {
            'form-content-end': '<div>TEST AGAIN</div>',
          },
        },
      },
      screenRenderers: [
        {
          prompt: 'login-id',
          screen: 'login-id',
          rendering_mode: 'standard',
          context_configuration: [],
          default_head_tags_disabled: false,
        },
        {
          prompt: 'signup-id',
          screen: 'signup-id',
          rendering_mode: 'advanced',
          context_configuration: ['branding.settings', 'branding.themes.default'],
          default_head_tags_disabled: false,
          head_tags: [
            {
              tag: 'script',
              attributes: {
                src: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
                async: true,
                defer: true,
                integrity: [
                  'sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==',
                ],
              },
            },
          ],
        },
      ],
    };

    await promptsHandler.dump(context);

    const dumpedFiles = getFiles(promptsDirectory, ['.json']);
    const dumpedScreenSettingsFiles = getFiles(promptsScreenSettingsDirectory, ['.json']);

    expect(dumpedFiles).to.deep.equal([
      path.join(promptsDirectory, customTextFile),
      path.join(promptsDirectory, partialsFile),
      path.join(promptsDirectory, promptsSettingsFile),
    ]);

    expect(dumpedScreenSettingsFiles).to.deep.equal([
      path.join(promptsScreenSettingsDirectory, loginIdSettingsFile),
      path.join(promptsScreenSettingsDirectory, signupIdSettingsFile),
    ]);

    expect(loadJSON(path.join(promptsDirectory, customTextFile), {})).to.deep.equal(
      context.assets.prompts.customText
    );
    expect(loadJSON(path.join(promptsDirectory, partialsFile), {})).to.deep.equal({
      login: [
        {
          login: [
            {
              name: 'form-content-start',
              template: 'partials/login/login/form-content-start.liquid',
            },
          ],
        },
      ],
      signup: [
        {
          signup: [
            {
              name: 'form-content-end',
              template: 'partials/signup/signup/form-content-end.liquid',
            },
          ],
        },
      ],
    });
    expect(loadJSON(path.join(promptsDirectory, promptsSettingsFile), {})).to.deep.equal({
      universal_login_experience: context.assets.prompts.universal_login_experience,
      identifier_first: context.assets.prompts.identifier_first,
    });

    expect(
      loadJSON(path.join(promptsScreenSettingsDirectory, loginIdSettingsFile), {})
    ).to.deep.equal({
      prompt: 'login-id',
      screen: 'login-id',
      rendering_mode: 'standard',
      context_configuration: [],
      default_head_tags_disabled: false,
    });

    expect(
      loadJSON(path.join(promptsScreenSettingsDirectory, signupIdSettingsFile), {})
    ).to.deep.equal({
      prompt: 'signup-id',
      screen: 'signup-id',
      rendering_mode: 'advanced',
      context_configuration: ['branding.settings', 'branding.themes.default'],
      default_head_tags_disabled: false,
      head_tags: [
        {
          tag: 'script',
          attributes: {
            src: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
            async: true,
            defer: true,
            integrity: [
              'sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==',
            ],
          },
        },
      ],
    });
  });
});
