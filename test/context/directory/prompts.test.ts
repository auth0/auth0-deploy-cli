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

const promptsSettingsFile = 'prompts.json';
const customTextFile = 'custom-text.json';
const partialsFile = 'partials.json';

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

      expect(context.assets.prompts).to.deep.equal({ customText: {}, partials: {} });
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

  it('should dump prompts settings and prompts custom text when API responses are empty', async () => {
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
    };

    await promptsHandler.dump(context);

    const dumpedFiles = getFiles(promptsDirectory, ['.json']);

    expect(dumpedFiles).to.deep.equal([
      path.join(promptsDirectory, customTextFile),
      path.join(promptsDirectory, partialsFile),
      path.join(promptsDirectory, promptsSettingsFile),
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
  });
});
