import { expect } from 'chai';

const a0deploy = require('../src');

describe('#index exports', () => {
  it('should expose functions for deploy, dump, import, and export', () => {
    expect(Object.keys(a0deploy)).to.have.all.members([ 'deploy', 'dump', 'import', 'export', 'tools' ]);
  });
});
