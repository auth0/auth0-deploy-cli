import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';
import { dumpJSON, existsMustBeDir, getFiles, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

type ParsedBranding = {
  branding: unknown | undefined;
};

function parse(context: DirectoryContext): ParsedBranding {
  const brandingDirectory = path.join(context.filePath, constants.BRANDING_DIRECTORY);

  if (!existsMustBeDir(brandingDirectory)) return { branding: undefined };

  const branding = loadJSON(path.join(brandingDirectory, 'branding.json'), context.mappings);

  const brandingTemplatesFolder = path.join(
    brandingDirectory,
    constants.BRANDING_TEMPLATES_DIRECTORY
  );

  if (!existsMustBeDir(brandingTemplatesFolder)) return { branding: context.assets.branding };

  const templatesDefinitionFiles = getFiles(brandingTemplatesFolder, ['.json']);
  const templates = templatesDefinitionFiles.map((templateDefinitionFile) => {
    const definition = loadJSON(templateDefinitionFile, context.mappings);
    definition.body = loadFileAndReplaceKeywords(
      path.join(brandingTemplatesFolder, definition.body),
      context.mappings
    );
    return definition;
  }, {});

  return {
    branding: {
      ...branding,
      templates,
    },
  };
}

async function dump(context: DirectoryContext) {
  const {
    branding: { templates = [], ...branding },
  } = context.assets;

  if (!!branding) dumpBranding(context);

  if (!!templates) dumpBrandingTemplates(context);
}

const dumpBrandingTemplates = ({ filePath, assets }: DirectoryContext): void => {
  if (!assets || !assets.branding) return;

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
