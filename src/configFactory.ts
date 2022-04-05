import { Config } from './types'

export type ConfigFunction = (arg0: keyof Config) => any // TODO: refactor configFactory function to allow for more precise typing

export const configFactory = () => {
  const settings: Partial<Config> = {};
  let currentProvider: ConfigFunction | null = null;

  const config = function getConfig(key: keyof Config) {
    if (settings && settings[key]) {
      return settings[key];
    }

    if (!currentProvider) {
      throw new Error('A configuration provider has not been set');
    }

    return currentProvider(key);
  };

  config.setProvider = function setProvider(providerFunction: ConfigFunction) {
    currentProvider = providerFunction;
  };

  config.setValue = function setValue(key: keyof Config, value: any) {
    settings[key] = value;
  };

  return config;
};