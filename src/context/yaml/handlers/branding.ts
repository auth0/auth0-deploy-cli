import path from 'path';
import fs from 'fs-extra';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import log from '../../../logger';

type BrandingTemplate = {
  template: string;
  body: string;
};

type ParsedBranding = ParsedAsset<
  'branding',
  { [key: string]: Asset } & {
    templates?: BrandingTemplate[];
  }
>;

async function parse(context: YAMLContext): Promise<ParsedBranding> {
  if (!context.assets.branding) return { branding: null };

  const {
    branding: { templates, ...branding },
  } = context.assets;

  if (!templates) {
    return { branding: { ...branding } };
  }

  const parsedTemplates: BrandingTemplate[] = templates.map(
    (templateDefinition: BrandingTemplate): BrandingTemplate => {
      const brandingTemplatesFolder = path.join(
        context.basePath,
        constants.BRANDING_TEMPLATES_YAML_DIRECTORY
      );
      const file = `${templateDefinition.template}.html`;
      const markupFile = path.join(brandingTemplatesFolder, file);
      return {
        template: templateDefinition.template,
        body: loadFileAndReplaceKeywords(markupFile, {
          mappings: context.mappings,
          disableKeywordReplacement: context.disableKeywordReplacement,
        }),
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
  if (!context.assets.branding) return { branding: null };

  const { templates: templateConfig, ...branding } = context.assets.branding;

  let templates = templateConfig || [];

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
      log.info(`Writing ${templateMarkupFile}`);
      const markup = templateDefinition.body;
      try {
        fs.writeFileSync(templateMarkupFile, markup);
      } catch (e) {
        throw new Error(
          `Error writing template file: ${templateDefinition.template}, because: ${e.message}`
        );
      }

      // save the location as relative file.
      templateDefinition.body = `./${constants.BRANDING_TEMPLATES_YAML_DIRECTORY}/${file}`;

      return templateDefinition;
    });
  }

  return { branding: { templates, ...branding } };
}

const brandingHandler: YAMLHandler<ParsedBranding> = {
  parse,
  dump,
};

export default brandingHandler;
