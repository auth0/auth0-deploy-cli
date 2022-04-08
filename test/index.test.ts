import { expect } from 'chai';

import a0deploy, { dump, deploy } from '../src';

describe('#index exports', () => {
  it('should expose functions for deploy, dump, import, and export', () => {
    expect(typeof a0deploy).to.equal('object');
    expect(Object.keys(a0deploy)).to.have.all.members([
      'deploy',
      'dump',
      'import',
      'export',
      'tools',
    ]);

    [a0deploy.deploy, a0deploy.dump, a0deploy.export, a0deploy.import].forEach((fn) => {
      expect(typeof fn).to.equal('function');
    });

    expect(typeof dump).to.equal('function');
    expect(typeof deploy).to.equal('function');
  });
});
