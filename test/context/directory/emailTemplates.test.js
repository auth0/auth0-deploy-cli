import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/emailTemplates';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const emailTemplates = {
  'provider.json': '{"name": "smtp"}',
  'verify_email.json':
    '{ "template": "verify_email", "enabled": true, "from": "test@##env##.com" , "body" : "./verify_email.html.liquid" }',
  'verify_email.html.liquid': '<html>some ##env## email</html>',
  'welcome_email.json':
    '{ "template": "welcome_email", "enabled": true, "from": "test@##env##.com" }',
  'welcome_email.html': '<html>some ##env## email</html>',
};

const emailTemplatesTarget = [
  {
    body: '<html>some test email</html>',
    enabled: true,
    from: 'test@test.com',
    template: 'verify_email',
  },
  {
    body: '<html>some test email</html>',
    enabled: true,
    from: 'test@test.com',
    template: 'welcome_email',
  },
];

describe('#directory context email templates', () => {
  it('should process email templates', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'emailTemplates1');
    const dir = path.join(repoDir);
    createDir(dir, { [constants.EMAIL_TEMPLATES_DIRECTORY]: emailTemplates });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.emailTemplates).to.deep.equal(emailTemplatesTarget);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.EMAIL_TEMPLATES_DIRECTORY]: {
        ...emailTemplates,
        'README.md': 'something',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'emailTemplates2');
    const dir = path.join(repoDir);
    createDir(dir, files);
    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.emailTemplates).to.deep.equal(emailTemplatesTarget);
  });

  it('should ignore bad email templates directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rules3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.EMAIL_TEMPLATES_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir });
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump email templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'emailTemplatesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.emailTemplates = [
      {
        body: '<html>test</html>',
        enabled: true,
        from: 'test@email.com',
        subject: 'something',
        syntax: 'liquid',
        template: 'verify_email',
      },
      {
        body: '<html>test</html>',
        enabled: true,
        from: 'test@email.com',
        subject: 'something',
        syntax: 'liquid',
        template: 'welcome_email',
      },
    ];

    await handler.dump(context);

    const emailTemplateFolder = path.join(dir, constants.EMAIL_TEMPLATES_DIRECTORY);

    expect(loadJSON(path.join(emailTemplateFolder, 'verify_email.json'))).to.deep.equal({
      body: './verify_email.html',
      enabled: true,
      from: 'test@email.com',
      subject: 'something',
      syntax: 'liquid',
      template: 'verify_email',
    });
    expect(
      fs.readFileSync(path.join(emailTemplateFolder, 'verify_email.html'), 'utf8')
    ).to.deep.equal('<html>test</html>');

    expect(loadJSON(path.join(emailTemplateFolder, 'welcome_email.json'))).to.deep.equal({
      body: './welcome_email.html',
      enabled: true,
      from: 'test@email.com',
      subject: 'something',
      syntax: 'liquid',
      template: 'welcome_email',
    });
    expect(
      fs.readFileSync(path.join(emailTemplateFolder, 'welcome_email.html'), 'utf8')
    ).to.deep.equal('<html>test</html>');
  });
});
