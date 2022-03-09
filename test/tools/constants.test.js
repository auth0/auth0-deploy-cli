const { expect } = require('chai');
const tools = require('../../src/tools/index');

describe('#constants', () => {
  it('should be exposed', () => {
    expect(tools.constants.PAGE_NAMES).to.be.an('array');
    expect(tools.constants.RULES_STAGES).to.include('login_success');
  });
});
