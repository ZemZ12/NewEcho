const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-image can decode SVG natively, but Metro treats .svg as source code
// by default (for react-native-svg-transformer-style usage) — this project
// just wants it as a plain asset.
config.resolver.assetExts.push('svg');

module.exports = withNativeWind(config, { input: './global.css' });
