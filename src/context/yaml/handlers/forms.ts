import path from 'path';
import fs from 'fs-extra';
import dotProp from 'dot-prop';

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
  const formNames = forms.map((form) => form.name);
  const duplicateFormNames = formNames.filter((name, index) => formNames.indexOf(name) !== index);

  if (duplicateFormNames.length > 0) {
    log.error(
      `Duplicate form names found: [${duplicateFormNames.join(
        ', '
      )}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate form names found: ${duplicateFormNames.join(', ')}`);
  }

  forms = forms.map((form) => {
    if (form.name === undefined) {
      return form;
    }

    const formName = sanitize(form.name);

    const jsonFile = path.join(pagesFolder, `${formName}.json`);
    log.info(`Writing ${jsonFile}`);

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
