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

  it('should throw before validate when AUTH0_DRY_RUN is an invalid value', async () => {
    const validateStub = sandbox.stub(Auth0.prototype, 'validate').resolves();
    sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({ AUTH0_DRY_RUN: 'not-a-mode' });

    try {
      await deploy({}, {} as any, config);
      throw new Error('Expected deploy to throw');
    } catch (err) {
      sinon.assert.notCalled(validateStub);
      if ((err as Error).message === 'Expected deploy to throw') throw err;
    }
  });

  it('should call processChanges and return handler summary when dry-run is not set', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    const dryRunStub = sandbox.stub(Auth0.prototype, 'dryRun').resolves(true);
    const processChangesStub = sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({});
    const result = await deploy({}, {} as any, config);

    sinon.assert.notCalled(dryRunStub);
    sinon.assert.calledOnce(processChangesStub);
    sinon.assert.match(result, sinon.match.object);
  });

  it('should pass interactive=true to dryRun when AUTH0_DRY_RUN_INTERACTIVE is set', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    const dryRunStub = sandbox.stub(Auth0.prototype, 'dryRun').resolves(false);
    sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({
      AUTH0_DRY_RUN: 'preview',
      AUTH0_DRY_RUN_INTERACTIVE: true,
      AUTH0_DRY_RUN_APPLY: false,
    });

    await deploy({}, {} as any, config);

    sinon.assert.calledOnceWithExactly(dryRunStub, { interactive: true });
  });

  it('should normalize AUTH0_DRY_RUN=true (boolean) to preview mode', async () => {
    sandbox.stub(Auth0.prototype, 'validate').resolves();
    const dryRunStub = sandbox.stub(Auth0.prototype, 'dryRun').resolves(false);
    sandbox.stub(Auth0.prototype, 'processChanges').resolves();

    const config = buildConfig({
      AUTH0_DRY_RUN: true,
      AUTH0_DRY_RUN_INTERACTIVE: false,
    });

    await deploy({}, {} as any, config);

    sinon.assert.calledOnceWithExactly(dryRunStub, { interactive: false });
  });
});
