import { expect } from 'chai';
import Ajv from 'ajv';
import yaml from 'js-yaml';
import { schema as promptsSchema } from '../../../../src/tools/auth0/handlers/prompts';
import tenantSchema from '../../../../src/tools/auth0/schema';
import { languages } from '../../../../src/types';

const newAjv = () => new Ajv({ useDefaults: true, nullable: true });

describe('#prompts schema', () => {
  const customText = (promptsSchema as any).properties.customText;
  const promptTypes = Object.keys(customText.definitions.language.properties);
  const screenTypes = Object.keys(customText.definitions.promptType.properties);

  // The original, fully expanded form of the customText schema, used as the reference.
  const expandedCustomText = {
    type: 'object',
    properties: Object.fromEntries(
      languages.map((language) => [
        language,
        {
          type: 'object',
          properties: Object.fromEntries(
            promptTypes.map((promptType) => [
              promptType,
              {
                type: 'object',
                properties: Object.fromEntries(
                  screenTypes.map((screenType) => [screenType, { type: 'object' }])
                ),
              },
            ])
          ),
        },
      ])
    ),
  };
  const expandedSchema = {
    ...promptsSchema,
    properties: { ...(promptsSchema as any).properties, customText: expandedCustomText },
  };

  const compile = (schema: object) =>
    newAjv().compile({ type: 'object', properties: { prompts: schema } });

  it('keeps the customText schema small by referencing shared definitions', () => {
    // The expanded form is ~8MB; the referenced form should be a few hundred KB at most.
    expect(JSON.stringify(customText).length).to.be.lessThan(500 * 1024);
  });

  it('keeps compiling the full tenant schema cheap', () => {
    // The referenced form compiles in tens of ms (vs seconds/~1GB for the expanded form); the
    // bound is generous for slow CI. Keep this before the expanded-schema test: that test's ~1GB
    // compile leaves heap/GC pressure that slows a later compile enough to blow this bound.
    const started = Date.now();
    newAjv().compile(tenantSchema as object);
    expect(Date.now() - started).to.be.lessThan(1500);
  });

  it('validates customText identically to the fully expanded schema', () => {
    const leafValues: unknown[] = [{}, { a: 'b' }, 'text', 1, true, null, []];
    const cases: unknown[] = [{}, { customText: {} }, { customText: 'x' }, { customText: [] }];

    // Cover every language and prompt type, rotating through screen types and leaf values.
    languages.forEach((language, li) => {
      promptTypes.forEach((promptType, pi) => {
        // Rotate through screen types and leaf values so every one of each is exercised.
        const screenType = screenTypes[(li + pi) % screenTypes.length];
        const leaf = leafValues[(li + pi) % leafValues.length];
        cases.push({ customText: { [language]: { [promptType]: { [screenType]: leaf } } } });
        cases.push({ customText: { [language]: { [promptType]: 'not-an-object' } } });
      });
      cases.push({ customText: { [language]: 'not-an-object' } });
    });

    // Unknown languages, prompts and screens are not rejected by the original schema either.
    cases.push({ customText: { xx: { yy: { zz: {} } } } });

    const validateExpanded = compile(expandedSchema);
    const validateReferenced = compile(promptsSchema);

    cases.forEach((data) => {
      const wrapped = { prompts: data };
      const expected = validateExpanded(wrapped);
      const actual = validateReferenced(wrapped);
      if (actual !== expected) {
        expect.fail(`schemas disagree for ${JSON.stringify(data).slice(0, 200)}`);
      }
    });
  });

  it('validates a realistic customText config loaded from YAML', () => {
    const config = yaml.load(`
prompts:
  universal_login_experience: new
  identifier_first: true
  customText:
    en:
      login:
        login:
          title: Welcome back
          description: Log in to continue
          buttonText: Continue
      signup-password:
        signup-password:
          buttonText: Sign up
          editEmailText: Edit
      mfa-webauthn: {}
    fr:
      login:
        login:
          title: Bon retour
    es:
      login: {}
`);
    const ajv = newAjv();
    const valid = ajv.validate(tenantSchema, config);
    expect(valid, JSON.stringify(ajv.errors)).to.equal(true);

    // The same config with a wrongly typed screen is still rejected.
    const broken = yaml.load(`
prompts:
  customText:
    en:
      login:
        login: not-an-object
`);
    expect(ajv.validate(tenantSchema, broken)).to.equal(false);
  });

  it('resolves its refs when embedded in the full tenant schema', () => {
    const ajv = newAjv();
    const valid = ajv.validate(tenantSchema, {
      prompts: { customText: { en: { login: { login: { a: 1 } } } } },
    });
    expect(valid, JSON.stringify(ajv.errors)).to.equal(true);

    const invalid = ajv.validate(tenantSchema, {
      prompts: { customText: { en: { login: { login: 'not-an-object' } } } },
    });
    expect(invalid).to.equal(false);
  });
});
