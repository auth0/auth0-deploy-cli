import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedBranding = {
  branding: unknown;
};

async function parse(context: YAMLContext): Promise<ParsedBranding> {
  // Load the HTML file for each page
  const { branding } = context.assets;

  if (!branding && !branding['templates']) return { branding };

  const templates = branding.templates.map((templateDefinition) => {
    const markupFile = path.join(context.basePath, templateDefinition.body);
    return {
      template: templateDefinition.template,
      body: loadFileAndReplaceKeywords(markupFile, context.mappings),
    };
  });

  return {
    branding: {
      ...branding,
      templates,
    },
  };
}

async function dump(context: YAMLContext): Promise<ParsedBranding> {
  const { branding } = context.assets.branding;
  branding.templates = branding.templates || [];

  // create templates folder
  if (branding.templates.length) {
    const brandingTemplatesFolder = path.join(
      context.basePath,
      constants.BRANDING_TEMPLATES_YAML_DIRECTORY
    );
    fs.ensureDirSync(brandingTemplatesFolder);

    branding.templates = branding.templates.map((templateDefinition) => {
      const file = `${templateDefinition.template}.html`;
      const templateMarkupFile = path.join(brandingTemplatesFolder, file);
      const markup = templateDefinition.body;
      try {
        fs.writeFileSync(templateMarkupFile, markup);
      } catch (e) {
        throw new Error(
          `Error writing template file: ${templateDefinition.template}, because: ${e.message}`
        );
      }

      // save the location as relative file.
      templateDefinition.body = `.${path.sep}${path.join(
        constants.BRANDING_TEMPLATES_YAML_DIRECTORY,
        file
      )}`;
      return templateDefinition;
    });
  }

  return { branding };
}

const brandingHandler: YAMLHandler<ParsedBranding> = {
  parse,
  dump,
};

export default brandingHandler;
