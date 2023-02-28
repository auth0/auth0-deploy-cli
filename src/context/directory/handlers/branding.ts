import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';
import { dumpJSON, existsMustBeDir, getFiles, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedBranding = ParsedAsset<'branding', Asset>;

function parse(context: DirectoryContext): ParsedBranding {
  const brandingDirectory = path.join(context.filePath, constants.BRANDING_DIRECTORY);
  const brandingFile = path.join(brandingDirectory, 'branding.json');

  if (!existsMustBeDir(brandingDirectory)) return { branding: null };

  const brandingSettings = (() => {
    if (isFile(brandingFile)) {
      return loadJSON(brandingFile, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });
    }

    return null;
  })();

  const brandingTemplatesFolder = path.join(
    brandingDirectory,
    constants.BRANDING_TEMPLATES_DIRECTORY
  );

  if (!existsMustBeDir(brandingTemplatesFolder)) return { branding: brandingSettings };

  const templatesDefinitionFiles = getFiles(brandingTemplatesFolder, ['.json']);
  const templates = templatesDefinitionFiles.map((templateDefinitionFile) => {
    const definition = loadJSON(templateDefinitionFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });
    definition.body = loadFileAndReplaceKeywords(
      path.join(brandingTemplatesFolder, definition.body),
      {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }
    );
    return definition;
  }, {});

  return {
    branding: {
      ...brandingSettings,
      templates,
    },
  };
}

async function dump(context: DirectoryContext) {
  const { branding } = context.assets;

  if (!branding) return;

  dumpBranding(context);

  if (!!branding.templates) dumpBrandingTemplates(context);
}

const dumpBrandingTemplates = ({ filePath, assets }: DirectoryContext): void => {
  if (!assets.branding || !assets.branding.templates) return;

  const {
    branding: { templates = [] },
  } = assets;

  const brandingTemplatesFolder = path.join(
    filePath,
    constants.BRANDING_DIRECTORY,
    constants.BRANDING_TEMPLATES_DIRECTORY
  );
  fs.ensureDirSync(brandingTemplatesFolder);

  templates.forEach((templateDefinition) => {
    const markup = templateDefinition.body;
    try {
      fs.writeFileSync(
        path.join(brandingTemplatesFolder, `${templateDefinition.template}.html`),
        markup
      );
    } catch (e) {
      throw new Error(
        `Error writing template file: ${templateDefinition.template}, because: ${e.message}`
      );
    }

    // save the location as relative file.
    templateDefinition.body = `.${path.sep}${templateDefinition.template}.html`;
    dumpJSON(
      path.join(brandingTemplatesFolder, `${templateDefinition.template}.json`),
      templateDefinition
    );
  });
};

const dumpBranding = ({ filePath, assets }: DirectoryContext): void => {
  if (!assets || !assets.branding) return;

  const { branding } = assets;

  const brandingWithoutTemplates = (() => {
    const newBranding = { ...branding };
    delete newBranding.templates;
    return newBranding;
  })();

  const brandingDirectory = path.join(filePath, constants.BRANDING_DIRECTORY);

  fs.ensureDirSync(brandingDirectory);

  const brandingFilePath = path.join(brandingDirectory, 'branding.json');

  dumpJSON(brandingFilePath, brandingWithoutTemplates);
};

const brandingHandler: DirectoryHandler<ParsedBranding> = {
  parse,
  dump,
};

export default brandingHandler;
