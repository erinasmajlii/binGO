const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fixed resolution for "react/jsx-runtime" and "react/jsx-dev-runtime"
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react/jsx-runtime': require.resolve('react/jsx-runtime'),
  'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
};

module.exports = config;
