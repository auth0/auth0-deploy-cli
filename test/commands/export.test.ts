import { expect } from 'chai';
import * as sinon from 'sinon';

import exportCMD from '../../src/commands/export';
import * as contextModule from '../../src/context';

describe('#export command', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(contextModule, 'setupContext').resolves({
      dump: sandbox.stub().resolves(),
    } as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should set AUTH0_EXPORT_SECRETS when export_secrets flag is passed', async () => {
    await exportCMD({
      _: ['export'],
      output_folder: 'local',
      format: 'directory',
      export_secrets: true,
      env: false,
    } as any);

    const [config] = (contextModule.setupContext as sinon.SinonStub).firstCall.args;
    expect(config.AUTH0_EXPORT_SECRETS).to.equal(true);
  });

  it('should not set AUTH0_EXPORT_SECRETS when export_secrets flag is absent', async () => {
    await exportCMD({
      _: ['export'],
      output_folder: 'local',
      format: 'directory',
      env: false,
    } as any);

    const [config] = (contextModule.setupContext as sinon.SinonStub).firstCall.args;
    expect(config.AUTH0_EXPORT_SECRETS).to.equal(undefined);
  });
});
