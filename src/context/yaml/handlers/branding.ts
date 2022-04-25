import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type BrandingTemplate = {
  template: string;
  body: string;
};

type ParsedBranding = {
  branding:
    | ({ [key: string]: Asset } & {
        templates?: BrandingTemplate[];
      })
    | null;
};

async function parse(context: YAMLContext): Promise<ParsedBranding> {
  // Load the HTML file for each page
  if (!context.assets.branding)
    return {
      branding: {
        templates: [],
      },
    };

  if (context.assets.branding === null) return { branding: null };

  const {
    branding: { templates, ...branding },
  } = context.assets;

  if (templates === null || templates === undefined) {
    return { branding: { ...branding } };
  }

  const parsedTemplates: BrandingTemplate[] = templates.map(
    (templateDefinition: BrandingTemplate): BrandingTemplate => {
      const markupFile = path.join(context.basePath, templateDefinition.body);
      return {
        template: templateDefinition.template,
        body: loadFileAndReplaceKeywords(markupFile, context.mappings),
      };
    }
  );

  return {
    branding: {
      ...branding,
      templates: parsedTemplates,
    },
  };
}

async function dump(context: YAMLContext): Promise<ParsedBranding> {
  const { branding } = context.assets;

  if (branding === null) return { branding: null };

  let templates = branding.templates || [];

  // create templates folder
  if (templates.length) {
    const brandingTemplatesFolder = path.join(
      context.basePath,
      constants.BRANDING_TEMPLATES_YAML_DIRECTORY
    );
    fs.ensureDirSync(brandingTemplatesFolder);

    templates = templates.map((templateDefinition) => {
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

  return { branding: { templates } };
}

const brandingHandler: YAMLHandler<ParsedBranding> = {
  parse,
  dump,
};

export default brandingHandler;
