import * as sinon from 'sinon';

import { configFactory } from '../../src/configFactory';
import deploy from '../../src/tools/deploy';
import Auth0 from '../../src/tools/auth0';

describe('#tools deploy dry-run modes', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  function buildConfig(values: Record<string, any> = {}) {
    const config = configFactory();
    config.setProvider((key) => values[key as string]);
    return config;
  }

  it('should not exit when preview mode detects changes in non-interactive mode', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    sandbox.stub(Auth0.prototype, 'dryRun').resolves(true);
    sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const exitStub = sandbox.stub(process, 'exit').callsFake(((code?: number) => code) as any);
    const config = buildConfig({
      AUTH0_DRY_RUN: 'preview',
      AUTH0_DRY_RUN_INTERACTIVE: false,
    });

    await deploy({}, {} as any, config);

    sinon.assert.notCalled(exitStub);
    sinon.assert.notCalled(Auth0.prototype.processChanges as any);
  });

  it('should not exit when preview mode finds no changes', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    sandbox.stub(Auth0.prototype, 'dryRun').resolves(false);
    sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const exitStub = sandbox.stub(process, 'exit').callsFake(((code?: number) => code) as any);
    const config = buildConfig({
      AUTH0_DRY_RUN: 'preview',
      AUTH0_DRY_RUN_INTERACTIVE: false,
    });

    await deploy({}, {} as any, config);

    sinon.assert.notCalled(exitStub);
    sinon.assert.notCalled(Auth0.prototype.processChanges as any);
  });

  it('should show preview and then apply without prompting when apply-after-preview is enabled', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    const dryRunStub = sandbox.stub(Auth0.prototype, 'dryRun').resolves(true);
    const processChangesStub = sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({
      AUTH0_DRY_RUN: 'preview',
      AUTH0_DRY_RUN_INTERACTIVE: false,
      AUTH0_DRY_RUN_APPLY: true,
    });

    await deploy({}, {} as any, config);

    sinon.assert.calledOnceWithExactly(dryRunStub, { interactive: false });
    sinon.assert.calledOnce(processChangesStub);
  });

  it('should not apply when apply-after-preview is enabled but no changes are detected', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    const dryRunStub = sandbox.stub(Auth0.prototype, 'dryRun').resolves(false);
    const processChangesStub = sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({
      AUTH0_DRY_RUN: 'preview',
      AUTH0_DRY_RUN_INTERACTIVE: false,
      AUTH0_DRY_RUN_APPLY: true,
    });

    await deploy({}, {} as any, config);

    sinon.assert.calledOnceWithExactly(dryRunStub, { interactive: false });
    sinon.assert.notCalled(processChangesStub);
  });
});
