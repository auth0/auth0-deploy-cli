import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Form } from '../../../tools/auth0/handlers/forms';
import { loadJSON, sanitize } from '../../../utils';
import constants from '../../../tools/constants';

type ParsedForms = ParsedAsset<'forms', Partial<Form>[]>;

async function parse(context: YAMLContext): Promise<ParsedForms> {
  const { forms } = context.assets;

  if (!forms) return { forms: null };

  const parsedForms = forms.map((form: Form) => {
    const formFile = path.join(context.basePath, form.body);

    const parsedFormBody = loadJSON(formFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });

    // Remove the body from the form object
    delete parsedFormBody.body;

    return {
      name: form.name,
      ...parsedFormBody,
    };
  });

  return {
    forms: [...parsedForms],
  };
}

async function dump(context: YAMLContext): Promise<ParsedForms> {
  let { forms } = context.assets;

  if (!forms) {
    return { forms: null };
  }

  const pagesFolder = path.join(context.basePath, constants.FORMS_DIRECTORY);
  fs.ensureDirSync(pagesFolder);

  // Check if there is any duplicate form name
  const formNameSet = new Set();
  const duplicateFormNames = new Set();

  forms.forEach((form) => {
    if (formNameSet.has(form.name)) {
      duplicateFormNames.add(form.name);
    } else {
      formNameSet.add(form.name);
    }
  });

  if (duplicateFormNames.size > 0) {
    const duplicateNamesArray = Array.from(duplicateFormNames).join(', ');
    log.error(
      `Duplicate form names found: [${duplicateNamesArray}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate form names found: ${duplicateNamesArray}`);
  }

  forms = forms.map((form) => {
    if (form.name === undefined) {
      return form;
    }

    const formName = sanitize(form.name);

    const jsonFile = path.join(pagesFolder, `${formName}.json`);
    log.info(`Writing ${jsonFile}`);

    const removeKeysFromOutput = ['id', 'created_at', 'updated_at'];
    removeKeysFromOutput.forEach((key) => {
      if (key in form) {
        delete form[key];
      }
    });

    const jsonBody = JSON.stringify(form, null, 2);
    fs.writeFileSync(jsonFile, jsonBody);
    return {
      name: form.name,
      body: `./forms/${formName}.json`,
    };
  });

  return { forms };
}

const pagesHandler: YAMLHandler<ParsedForms> = {
  parse,
  dump,
};

export default pagesHandler;
