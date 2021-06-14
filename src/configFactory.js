module.exports = function() {
  const settings = { };
  let currentProvider = null;

  const config = function getConfig(key) {
    if (settings && settings[key]) {
      return settings[key];
    }

    if (!currentProvider) {
      throw new Error('A configuration provider has not been set');
    }

    return currentProvider(key);
  };

  config.setProvider = function setProvider(providerFunction) {
    currentProvider = providerFunction;
  };

  config.setValue = function setValue(key, value) {
    settings[key] = value;
  };

  return config;
};
