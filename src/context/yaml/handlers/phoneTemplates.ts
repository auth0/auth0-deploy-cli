import { YAMLHandler } from '.';
import YAMLContext from '..';
import { PhoneTemplate } from '../../../tools/auth0/handlers/phoneTemplates';
import { ParsedAsset } from '../../../types';
import { phoneTemplatesDefaults } from '../../defaults';

type ParsedPhoneTemplates = ParsedAsset<'phoneTemplates', PhoneTemplate[]>;

async function parse(context: YAMLContext): Promise<ParsedPhoneTemplates> {
  const { phoneTemplates } = context.assets;

  if (!phoneTemplates) return { phoneTemplates: null };

  return {
    phoneTemplates,
  };
}

async function dump(context: YAMLContext): Promise<ParsedPhoneTemplates> {
  const { phoneTemplates } = context.assets;

  if (!phoneTemplates) return { phoneTemplates: null };

  const processedTemplates = phoneTemplates.map((template) => phoneTemplatesDefaults(template));

  return {
    phoneTemplates: processedTemplates,
  };
}

const phoneTemplatesHandler: YAMLHandler<ParsedPhoneTemplates> = {
  parse,
  dump,
};

export default phoneTemplatesHandler;
