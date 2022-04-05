import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import {
  getFiles, existsMustBeDir, dumpJSON, loadJSON
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..'

type ParsedEmailTemplates = {
  emailTemplates: unknown | undefined
}

function parse(context: DirectoryContext): ParsedEmailTemplates {
  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(emailsFolder)) return { emailTemplates: undefined }; // Skip

  const files = getFiles(emailsFolder, ['.json', '.html']).filter((f) => path.basename(f) !== 'provider.json');

  const sorted = {};

  files.forEach((file) => {
    const { ext, name } = path.parse(file);
    if (!sorted[name]) sorted[name] = {};
    if (ext === '.json') sorted[name].meta = file;
    if (ext === '.html') sorted[name].html = file;
  });

  const emailTemplates = Object.values(sorted).flatMap(({
    meta,
    html
  }: {
    meta?: unknown,
    html?: string,
  }) => {
    if (!meta) {
      log.warn(`Skipping email template file ${html} as missing the corresponding '.json' file`);
      return [];
    } else if (!html) {
      log.warn(`Skipping email template file ${meta} as missing corresponding '.html' file`);
      return [];
    } else {
      return {
        ...loadJSON(meta, context.mappings),
        body: loadFileAndReplaceKeywords(html, context.mappings)
      };
    }
  });

  return {
    emailTemplates
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const emailTemplates = [...context.assets.emailTemplates || []];

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
}

export default emailTemplatesHandler;
