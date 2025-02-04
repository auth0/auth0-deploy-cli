import { expect } from 'chai';
import { configFactory, ConfigFunction } from '../src/configFactory';
import { Config } from '../src/types';

describe('configFactory', () => {
  let config: ReturnType<typeof configFactory>;

  beforeEach(() => {
    config = configFactory();
  });

  it('should set and get configuration values', () => {
    config.setValue('someKey' as keyof Config, 'someValue');
    expect(config('someKey' as keyof Config)).to.equal('someValue');
  });

  it('should throw an error if no provider is set and key is not in settings', () => {
    expect(() => config('someKey' as keyof Config)).to.throw(
      'A configuration provider has not been set'
    );
  });

  it('should use the provider function to get configuration values', () => {
    const providerFunction: ConfigFunction = (key) => {
      if ((key as string) === 'someKey') return 'providedValue';
      return null;
    };
    config.setProvider(providerFunction);
    expect(config('someKey' as keyof Config)).to.equal('providedValue');
  });

  it('should prioritize settings over provider function', () => {
    config.setValue('someKey' as keyof Config, 'someValue');
    const providerFunction: ConfigFunction = (key) => {
      if ((key as string) === 'someKey') return 'providedValue';
      return null;
    };
    config.setProvider(providerFunction);
    expect(config('someKey' as keyof Config)).to.equal('someValue');
  });
});
