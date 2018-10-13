import fs from 'fs-extra';
import path from 'path';

import { loadFilesByKey } from '../../../utils';
import log from '../../../logger';

const templateNames = [
  'verify_email',
  'reset_email',
  'welcome_email',
  'blocked_account',
  'stolen_credentials',
  'enrollment_email',
  'mfa_oob_code',
  'change_password',
  'password_reset'
];

async function parse(context) {
  // Load the HTML file for each page

  const emailTemplates = context.assets.emailTemplates || [];
  return {
    emailTemplates: [
      ...emailTemplates.map(et => loadFilesByKey(et, context.basePath, [ 'body' ], context.mappings))
    ]
  };
}

async function dump(mgmtClient, context) {
  let emailTemplates = [];

  await Promise.all(templateNames.map(async (name) => {
    try {
      const template = await mgmtClient.emailTemplates.get({ name });
      emailTemplates.push(template);
    } catch (err) {
      // Ignore if not found, else throw error
      if (err.statusCode !== 404) {
        throw err;
      }
    }
  }));

  if (emailTemplates.length > 0) {
    // Create Templates folder
    const templatesFolder = path.join(context.basePath, 'emailTemplates');
    fs.ensureDirSync(templatesFolder);
    emailTemplates = emailTemplates.map((template) => {
      // Dump template to file
      const templateFile = path.join(templatesFolder, `${template.template}.html`);
      log.info(`Writing ${templateFile}`);
      fs.writeFileSync(templateFile, template.body);
      return { ...template, body: templateFile };
    });
  }


  return { emailTemplates };
}


export default {
  parse,
  dump
};
