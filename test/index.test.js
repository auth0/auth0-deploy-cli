import { expect } from 'chai';

const a0deploy = require('../src');

describe('#index exports', () => {
  it('should expose functions for deploy, dump, import, export, and convert', () => {
    expect(Object.keys(a0deploy)).to.have.all.members([
      'deploy',
      'dump',
      'import',
      'export',
      'convert'
    ]);
  });
});
