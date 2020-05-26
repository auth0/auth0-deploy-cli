import fs from 'fs-extra';
import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';


function parse(context) {
  const emailsFolder = path.join(context.filePath, constants.EMAIL_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(emailsFolder)) return { emailTemplates: undefined }; // Skip

  const files = getFiles(emailsFolder, [ '.json', '.html' ]).filter(f => path.basename(f) !== 'provider.json');

  const sorted = {};

  files.forEach((file) => {
    const { ext, name } = path.parse(file);
    if (!sorted[name]) sorted[name] = {};
    if (ext === '.json') sorted[name].meta = file;
    if (ext === '.html') sorted[name].html = file;
  });

  const emailTemplates = [];
  Object.values(sorted).forEach((data) => {
    if (!data.meta) {
      log.warn(`Skipping email template file ${data.html} as missing the corresponding '.json' file`);
    } else if (!data.html) {
      log.warn(`Skipping email template file ${data.meta} as missing corresponding '.html' file`);
    } else {
      emailTemplates.push({
        ...loadJSON(data.meta, context.mappings),
        body: loadFile(data.html, context.mappings)
      });
    }
  });

  return {
    emailTemplates
  };
}


async function dump(context) {
  const emailTemplates = [ ...context.assets.emailTemplates || [] ];

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
    log.info(`Writing ${templateFile}`);
    fs.writeFileSync(templateFile, JSON.stringify({ ...template, body: `./${template.template}.html` }, null, 2));
  });
}


export default {
  parse,
  dump
};
