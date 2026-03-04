import { expect } from 'chai';
import * as sinon from 'sinon';

import importCMD from '../../src/commands/import';
import * as contextModule from '../../src/context';
import * as toolsModule from '../../src/tools';

describe('#import command dry-run behavior', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(contextModule, 'setupContext').resolves({
      assets: {},
      mgmtClient: {},
      loadAssetsFromLocal: sandbox.stub().resolves(),
    } as any);
    sandbox.stub(toolsModule, 'deploy').resolves({} as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should normalize boolean dry-run to preview', async () => {
    await importCMD({
      _: ['import'],
      input_file: 'tenant.yaml',
      dry_run: true,
      env: false,
    } as any);

    const [, , config] = (toolsModule.deploy as sinon.SinonStub).firstCall.args;
    expect(config('AUTH0_DRY_RUN')).to.equal('preview');
  });

  it('should normalize bare dry-run to preview', async () => {
    await importCMD({
      _: ['import'],
      input_file: 'tenant.yaml',
      dry_run: '',
      env: false,
    } as any);

    const [, , config] = (toolsModule.deploy as sinon.SinonStub).firstCall.args;
    expect(config('AUTH0_DRY_RUN')).to.equal('preview');
  });

  it('should not enable dry-run when the flag is absent', async () => {
    await importCMD({
      _: ['import'],
      input_file: 'tenant.yaml',
      env: false,
    } as any);

    const [, , config] = (toolsModule.deploy as sinon.SinonStub).firstCall.args;
    expect(config('AUTH0_DRY_RUN')).to.equal(undefined);
  });

  it('should reject invalid dry-run values', async () => {
    try {
      await importCMD({
        _: ['import'],
        input_file: 'tenant.yaml',
        dry_run: 'totally-not-a-mode',
        env: false,
      } as any);
      expect.fail('Expected importCMD to reject invalid --dry-run values.');
    } catch (error) {
      expect((error as Error).message).to.equal(
        'Invalid value for --dry-run: totally-not-a-mode. Use --dry-run or --dry-run=preview.'
      );
    }
  });

  it('should require --dry-run when apply is enabled', async () => {
    try {
      await importCMD({
        _: ['import'],
        input_file: 'tenant.yaml',
        apply: true,
        env: false,
      } as any);
      expect.fail('Expected importCMD to reject when --apply is used without --dry-run.');
    } catch (error) {
      expect((error as Error).message).to.equal('--apply must be used with --dry-run.');
    }
  });

  it('should set AUTH0_DRY_RUN_APPLY when apply is enabled', async () => {
    await importCMD({
      _: ['import'],
      input_file: 'tenant.yaml',
      dry_run: true,
      apply: true,
      env: false,
    } as any);

    const [, , config] = (toolsModule.deploy as sinon.SinonStub).firstCall.args;
    expect(config('AUTH0_DRY_RUN_APPLY')).to.equal(true);
  });
});
