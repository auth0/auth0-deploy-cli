import path from 'path';
import { expect } from 'chai';
import Context from '../../../src/context/directory';
import { cleanThenMkdir, createDir, mockMgmtClient, testDataDir } from '../../utils';
import handler from '../../../src/context/directory/handlers/riskAssessmentsNewDevice';
import { loadJSON } from '../../../src/utils';

describe('#directory context risk-assessments new-device', () => {
  it('should replace keywords', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true}',
        'new-device.json': '{"remember_for": @@REMEMBER_FOR_DAYS@@}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDevice1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        REMEMBER_FOR_DAYS: 30,
      },
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      remember_for: 30,
    };

    expect(context.assets.riskAssessmentsNewDevice).to.deep.equal(target);
  });

  it('should process risk-assessments new-device', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true}',
        'new-device.json': '{"remember_for": 30}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDevice2');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      remember_for: 30,
    };

    expect(context.assets.riskAssessmentsNewDevice).to.deep.equal(target);
  });

  it('should process risk-assessments new-device with zero value', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true}',
        'new-device.json': '{"remember_for": 0}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDevice3');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      remember_for: 0,
    };

    expect(context.assets.riskAssessmentsNewDevice).to.deep.equal(target);
  });

  it('should process risk-assessments new-device with large value', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true}',
        'new-device.json': '{"remember_for": 365}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDevice4');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      remember_for: 365,
    };

    expect(context.assets.riskAssessmentsNewDevice).to.deep.equal(target);
  });

  it('should dump risk-assessments new-device', async () => {
    const dir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDeviceDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.riskAssessmentsNewDevice = {
      remember_for: 90,
    };

    await handler.dump(context);
    const riskAssessmentsFolder = path.join(dir, 'risk-assessments');

    expect(loadJSON(path.join(riskAssessmentsFolder, 'new-device.json'))).to.deep.equal(
      context.assets.riskAssessmentsNewDevice
    );
  });

  it('should not create files if riskAssessmentsNewDevice is null', async () => {
    const dir = path.join(testDataDir, 'directory', 'riskAssessmentsNewDeviceNull');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.riskAssessmentsNewDevice = null;

    await handler.dump(context);
    const riskAssessmentsFolder = path.join(dir, 'risk-assessments');

    expect(() => loadJSON(path.join(riskAssessmentsFolder, 'new-device.json'))).to.throw();
  });
});
