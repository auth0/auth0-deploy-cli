import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Form } from '../../../tools/auth0/handlers/forms';

type ParsedFroms = ParsedAsset<'forms', Form[]>;

function parse(context: DirectoryContext): ParsedFroms {
  const formsFolder = path.join(context.filePath, constants.FORMS_DIRECTORY);
  if (!existsMustBeDir(formsFolder)) return { forms: null }; // Skip

  const files = getFiles(formsFolder, ['.json']);

  const forms = files.map((f) => {
    const form = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return form;
  });

  return {
    forms,
  };
}

async function dump(context: DirectoryContext) {
  const { forms } = context.assets;

  if (!forms) return; // Skip, nothing to dump

  const formsFolder = path.join(context.filePath, constants.FORMS_DIRECTORY);
  fs.ensureDirSync(formsFolder);

  forms.forEach((from) => {
    const formFile = path.join(formsFolder, sanitize(`${from.name}.json`));
    log.info(`Writing ${formFile}`);

    dumpJSON(formFile, from);
  });
}

const formsHandler: DirectoryHandler<ParsedFroms> = {
  parse,
  dump,
};

export default formsHandler;
