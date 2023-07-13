import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { existsSync } from 'fs';

type ParsedEmailTemplates = ParsedAsset<'emailTemplates', Asset[]>;

function parse(context: DirectoryContext): ParsedEmailTemplates {
  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(emailsFolder)) return { emailTemplates: null }; // Skip

  const jsonFiles = getFiles(emailsFolder, ['.json']).filter(
    (f) => path.basename(f) !== 'provider.json'
  );

  const emailTemplates = jsonFiles.flatMap((filePath: string) => {
    const meta: { body: string | undefined } = loadJSON(filePath, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });

    const templateFilePath = (() => {
      if (meta.body !== undefined) {
        const explicitlyDefinedPath = path.join(emailsFolder, meta.body);
        if (existsSync(explicitlyDefinedPath)) return explicitlyDefinedPath;
      }

      const defaultPath = path.join(emailsFolder, path.parse(filePath).name + '.html');

      if (existsSync(defaultPath)) return defaultPath;
      return null;
    })();

    if (templateFilePath === null) {
      log.warn(
        `Skipping email template file ${meta.body} as missing the corresponding '.json' file`
      );
      return [];
    }

    return {
      ...meta,
      body: loadFileAndReplaceKeywords(templateFilePath, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
  });

  return {
    emailTemplates,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const emailTemplates = context.assets.emailTemplates;

  if (!emailTemplates) return; // Skip, nothing to dump

  // Create Templates folder
  const templatesFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(templatesFolder);
  emailTemplates.forEach((template) => {
    // Dump template html to file
    const templateHtml = path.join(templatesFolder, `${template.template}.html`);
    log.info(`Writing ${templateHtml}`);
    fs.writeFileSync(templateHtml, template.body);

    // Dump template metadata
    const templateFile = path.join(templatesFolder, `${template.template}.json`);
    dumpJSON(templateFile, { ...template, body: `./${template.template}.html` });
  });
}

const emailTemplatesHandler: DirectoryHandler<ParsedEmailTemplates> = {
  parse,
  dump,
};

export default emailTemplatesHandler;
