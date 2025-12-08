import path from 'path';
import { expect } from 'chai';
import Context from '../../../src/context/directory';
import { cleanThenMkdir, createDir, mockMgmtClient, testDataDir } from '../../utils';
import handler from '../../../src/context/directory/handlers/riskAssessments';
import { loadJSON } from '../../../src/utils';

describe('#directory context risk-assessments', () => {
  it('should process risk-assessments with newDevice from settings.json', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true, "newDevice": {"remember_for": 30}}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessments1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      enabled: true,
      newDevice: {
        remember_for: 30,
      },
    };

    expect(context.assets.riskAssessment).to.deep.equal(target);
  });

  it('should replace keywords in newDevice settings', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": true, "newDevice": {"remember_for": @@REMEMBER_FOR_DAYS@@}}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessments3');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        REMEMBER_FOR_DAYS: 60,
      },
    };

    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      enabled: true,
      newDevice: {
        remember_for: 60,
      },
    };

    expect(context.assets.riskAssessment).to.deep.equal(target);
  });

  it('should process risk-assessments without newDevice', async () => {
    const files = {
      'risk-assessments': {
        'settings.json': '{"enabled": false}',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'riskAssessments4');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = {
      enabled: false,
    };

    expect(context.assets.riskAssessment).to.deep.equal(target);
  });

  it('should dump risk-assessments with newDevice to settings.json', async () => {
    const dir = path.join(testDataDir, 'directory', 'riskAssessmentsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.riskAssessment = {
      enabled: true,
      newDevice: {
        remember_for: 90,
      },
    };

    await handler.dump(context);
    const riskAssessmentsFolder = path.join(dir, 'risk-assessments');

    expect(loadJSON(path.join(riskAssessmentsFolder, 'settings.json'))).to.deep.equal(
      context.assets.riskAssessment
    );
  });

  it('should dump risk-assessments without newDevice', async () => {
    const dir = path.join(testDataDir, 'directory', 'riskAssessmentsDump2');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.riskAssessment = {
      enabled: false,
    };

    await handler.dump(context);
    const riskAssessmentsFolder = path.join(dir, 'risk-assessments');

    expect(loadJSON(path.join(riskAssessmentsFolder, 'settings.json'))).to.deep.equal(
      context.assets.riskAssessment
    );
  });

  it('should not create files if riskAssessment is null', async () => {
    const dir = path.join(testDataDir, 'directory', 'riskAssessmentsNull');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.riskAssessment = null;

    await handler.dump(context);
    const riskAssessmentsFolder = path.join(dir, 'risk-assessments');

    expect(() => loadJSON(path.join(riskAssessmentsFolder, 'settings.json'))).to.throw();
  });
});
