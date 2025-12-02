import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { existsMustBeDir, getFiles, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { PhoneTemplate } from '../../../tools/auth0/handlers/phoneTemplates';
import { phoneTemplatesDefaults } from '../../defaults';

type ParsedPhoneTemplates = ParsedAsset<'phoneTemplates', PhoneTemplate[]>;

function parse(context: DirectoryContext): ParsedPhoneTemplates {
  const phoneTemplatesFolder = path.join(context.filePath, constants.PHONE_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(phoneTemplatesFolder)) return { phoneTemplates: null }; // Skip

  const files = getFiles(phoneTemplatesFolder, ['.json']);

  const phoneTemplates = files.map((f) =>
    loadJSON(f, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    })
  );

  return { phoneTemplates };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { phoneTemplates } = context.assets;

  if (!phoneTemplates) {
    return;
  } // Skip, nothing to dump

  const phoneTemplatesFolder = path.join(context.filePath, constants.PHONE_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(phoneTemplatesFolder);

  phoneTemplates.forEach((template) => {
    // Strip read-only fields (id, channel, customizable, tenant) that are returned by the API but should not be included in exported config
    const templateWithDefaults = phoneTemplatesDefaults(template);
    const templateFile = path.join(phoneTemplatesFolder, `${template.type}.json`);
    dumpJSON(templateFile, templateWithDefaults);
  });
}

const phoneTemplatesHandler: DirectoryHandler<ParsedPhoneTemplates> = {
  parse,
  dump,
};

export default phoneTemplatesHandler;
