import fs from 'fs-extra';
import path from 'path';
import {
  constants, loadFileAndReplaceKeywords
} from '../../../tools';
import {
  dumpJSON, existsMustBeDir, getFiles, loadJSON
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..';

type ParsedBranding = {
  branding: unknown | undefined
}

function parse(context: DirectoryContext): ParsedBranding {
  const brandingTemplatesFolder = path.join(context.filePath, constants.BRANDING_DIRECTORY, constants.BRANDING_TEMPLATES_DIRECTORY);

  if (!existsMustBeDir(brandingTemplatesFolder)) return { branding: context.assets.branding };

  const templatesDefinitionFiles = getFiles(brandingTemplatesFolder, ['.json']);
  const templates = templatesDefinitionFiles.map((templateDefinitionFile) => {
    const definition = loadJSON(templateDefinitionFile, context.mappings);
    definition.body = loadFileAndReplaceKeywords(path.join(brandingTemplatesFolder, definition.body), context.mappings);
    return definition;
  }, {});

  return {
    branding: {
      templates
    }
  };
}

async function dump(context) {
  const { branding } = context.assets;

  if (!branding || !branding.templates || !branding.templates) return; // Skip, nothing to dump

  const brandingTemplatesFolder = path.join(context.filePath, constants.BRANDING_DIRECTORY, constants.BRANDING_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(brandingTemplatesFolder);

  branding.templates.forEach((templateDefinition) => {
    const markup = templateDefinition.body;
    try {
      fs.writeFileSync(path.join(brandingTemplatesFolder, `${templateDefinition.template}.html`), markup);
    } catch (e) {
      throw new Error(`Error writing template file: ${templateDefinition.template}, because: ${e.message}`);
    }

    // save the location as relative file.
    templateDefinition.body = `.${path.sep}${templateDefinition.template}.html`;
    dumpJSON(path.join(brandingTemplatesFolder, `${templateDefinition.template}.json`), templateDefinition);
  });
}

const brandingHandler: DirectoryHandler<ParsedBranding> = {
  parse,
  dump,
}

export default brandingHandler;