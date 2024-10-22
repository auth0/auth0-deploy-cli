import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Form } from '../../../tools/auth0/handlers/forms';

type ParsedForms = ParsedAsset<'forms', Form[]>;

async function parse(context: YAMLContext): Promise<ParsedForms> {
  const { forms } = context.assets;

  if (!forms) return { forms: null };

  return {
    forms: [
      ...forms.map((form) => ({
        ...form,
      })),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedForms> {
  let { forms } = context.assets;

  if (!forms) {
    return { forms: null };
  }

  const pagesFolder = path.join(context.basePath, 'forms');
  fs.ensureDirSync(pagesFolder);

  forms = forms.map((form) => {
    if (form.name === undefined) {
      return form;
    }

    const jsonFile = path.join(pagesFolder, `${form.name}.json`);
    log.info(`Writing ${jsonFile}`);
    fs.writeFileSync(jsonFile, form.name);
    return {
      ...form,
      html: `./forms/${form.name}.json`,
    };
  });

  return { forms };
}

const pagesHandler: YAMLHandler<ParsedForms> = {
  parse,
  dump,
};

export default pagesHandler;
