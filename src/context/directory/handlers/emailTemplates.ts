import path from 'path';
import fs from 'fs-extra';
import { existsSync } from 'fs';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

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

    if (meta.body !== undefined) {
      const configRoot = path.resolve(context.filePath);
      const resolvedTemplatePath = path.resolve(templateFilePath);
      if (!resolvedTemplatePath.startsWith(configRoot + path.sep)) {
        log.warn(
          `Email template body path "${meta.body}" resolves to "${resolvedTemplatePath}" which is outside the config directory "${configRoot}". ` +
            `This will be blocked as an error in the next major release. ` +
            `Move the file inside your config directory.`
        );
      }
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
  const { emailTemplates } = context.assets;

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
