const { expect } = require('chai');
const tools = require('../../src/tools/index');

describe('#constants', () => {
  it('should be exposed', () => {
    expect(tools.constants.PAGE_NAMES).to.be.an('array');
    expect(tools.constants.RULES_STAGES).to.include('login_success');
  });

  it('should include async_approval in EMAIL_TEMPLATES_TYPES', () => {
    expect(tools.constants.EMAIL_TEMPLATES_TYPES).to.be.an('array');
    expect(tools.constants.EMAIL_TEMPLATES_TYPES).to.include('async_approval');
  });

  it('should expose EMAIL_ASYNC_APPROVAL constant', () => {
    expect(tools.constants.EMAIL_ASYNC_APPROVAL).to.equal('async_approval');
  });
});
