import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context email templates', () => {
  it('should process email provider', async () => {
    const dir = path.join(testDataDir, 'yaml', 'emailTemplates');
    cleanThenMkdir(dir);

    const htmlContext = '<html>##ENV##</html>';
    const htmlFile = writeStringToFile(path.join(dir, 'body.html'), htmlContext);

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
    const yamlFile = writeStringToFile(path.join(dir, 'config.yaml'), yaml);

    const target = [
      {
        body: '<html>test</html>',
        enabled: true,
        from: 'test@email.com',
        subject: 'something',
        syntax: 'liquid',
        template: 'verify_email'
      },
      {
        body: '<html>test</html>',
        enabled: true,
        from: 'test@email.com',
        subject: 'something',
        syntax: 'liquid',
        template: 'welcome_email'
      }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.emailTemplates).to.deep.equal(target);
  });
});
