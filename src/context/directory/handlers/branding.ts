import fs from 'fs-extra';
import path from 'path';
import {
  constants, loadFileAndReplaceKeywords
} from '../../../tools';
import {
  dumpJSON, existsMustBeDir, getFiles, loadJSON, isFile
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..';
import log from '../../../logger';

type ParsedBranding = {
  branding: unknown | undefined;
};

function parse(context: DirectoryContext): ParsedBranding {
  const brandingFolder = path.join(context.filePath, constants.BRANDING_DIRECTORY);
  const brandingTemplatesFolder = path.join(brandingFolder, constants.BRANDING_TEMPLATES_DIRECTORY);
  const brandingFile = path.join(brandingFolder, 'branding.json');
  var branding = {};

  if (!existsMustBeDir(brandingTemplatesFolder)) return { branding: context.assets.branding };

  if (isFile(brandingFile)) {
    branding = loadJSON(brandingFile, context.mappings);
  }

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

async function dumpTemplates(context) {
  const { branding } = context.assets;

  if (!branding.templates) return; // Skip, nothing to dump

  const brandingTemplatesFolder = path.join(
    context.filePath,
    constants.BRANDING_DIRECTORY,
    constants.BRANDING_TEMPLATES_DIRECTORY
  );
  fs.ensureDirSync(brandingTemplatesFolder);

  branding.templates.forEach((templateDefinition) => {
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
}

async function dump(context) {
  const { branding } = context.assets;
  var data = { ...branding };

  if (!branding) return; // Skip, nothing to dump

  const brandingFolder = path.join(context.filePath, constants.BRANDING_DIRECTORY);
  fs.ensureDirSync(brandingFolder);

  delete data.templates;
  const brandingFile = path.join(brandingFolder, 'branding.json');
  log.info(`Writing ${brandingFile}`);
  fs.writeFileSync(brandingFile, JSON.stringify(data, null, 2));
  dumpTemplates(context);
}

const brandingHandler: DirectoryHandler<ParsedBranding> = {
  parse,
  dump,
};

export default brandingHandler;
