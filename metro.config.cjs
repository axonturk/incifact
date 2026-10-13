// Metro (Expo SDK 52) config: the shared rule engine and its generated data are ES modules with the .mjs extension.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = Array.from(new Set([...config.resolver.sourceExts, 'mjs']));

module.exports = config;
