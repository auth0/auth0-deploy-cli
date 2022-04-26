import fs from 'fs-extra';
import path from 'path';
import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedEmailTemplates = {
  emailTemplates: Asset[] | null;
};

async function parse(context: YAMLContext): Promise<ParsedEmailTemplates> {
  // Load the HTML file for each page
  const { emailTemplates } = context.assets;

  if (!emailTemplates) return { emailTemplates: null };

  return {
    emailTemplates: [
      ...emailTemplates.map((et) => ({
        ...et,
        body: context.loadFile(et.body),
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedEmailTemplates> {
  let emailTemplates = context.assets.emailTemplates;

  if (!emailTemplates) {
    return { emailTemplates: null };
  }

  // Create Templates folder
  const templatesFolder = path.join(context.basePath, 'emailTemplates');
  fs.ensureDirSync(templatesFolder);
  emailTemplates = emailTemplates.map((template) => {
    // Dump template to file
    const templateFile = path.join(templatesFolder, `${template.template}.html`);
    log.info(`Writing ${templateFile}`);
    fs.writeFileSync(templateFile, template.body);
    return { ...template, body: `./emailTemplates/${template.template}.html` };
  });

  return { emailTemplates };
}

const emailTemplatesHandler: YAMLHandler<ParsedEmailTemplates> = {
  parse,
  dump,
};

export default emailTemplatesHandler;
