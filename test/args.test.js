import { expect } from 'chai';
import { constructArgs } from '../src/args';


describe('#args', () => {
  it('should throw if no command is specified', () => {
    const constructedArgs = constructArgs().exitProcess(false);

    expect(() => constructedArgs.parse('')).to.throw('A command is required');
  });

  it('should not attempt to resolve args', () => {
    expect(() => constructArgs()).to.not.throw();
  });
});
