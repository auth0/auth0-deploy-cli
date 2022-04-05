import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/emailTemplates';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context email templates', () => {
  it('should process email provider', async () => {
    const dir = path.join(testDataDir, 'yaml', 'emailTemplates');
    cleanThenMkdir(dir);

    const htmlContext = '<html>##ENV##</html>';
    const htmlFile = path.join(dir, 'body.html');
    fs.writeFileSync(htmlFile, htmlContext);

    const yaml = `
    emailTemplates:
      - template: "verify_email"
        enabled: true
        syntax: "liquid"
        from: "test@email.com"
        subject: "something"
        body: ${htmlFile}
    
      - template: "welcome_email"
        enabled: true
        syntax: "liquid"
        from: "test@email.com"
        subject: "something"
        body: ${htmlFile}
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
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

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.emailTemplates).to.deep.equal(target);
  });

  it('should dump email templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'emailTemplatesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );

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

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      emailTemplates: [
        {
          body: './emailTemplates/verify_email.html',
          enabled: true,
          from: 'test@email.com',
          subject: 'something',
          syntax: 'liquid',
          template: 'verify_email',
        },
        {
          body: './emailTemplates/welcome_email.html',
          enabled: true,
          from: 'test@email.com',
          subject: 'something',
          syntax: 'liquid',
          template: 'welcome_email',
        },
      ],
    });

    const templatesFolder = path.join(dir, 'emailTemplates');
    expect(fs.readFileSync(path.join(templatesFolder, 'verify_email.html'), 'utf8')).to.deep.equal(
      '<html>test</html>'
    );
    expect(fs.readFileSync(path.join(templatesFolder, 'welcome_email.html'), 'utf8')).to.deep.equal(
      '<html>test</html>'
    );
  });
});
