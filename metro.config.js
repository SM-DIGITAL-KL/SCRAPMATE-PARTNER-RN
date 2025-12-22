const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * JavaScript obfuscation is handled via build scripts for production builds.
 * For development, use standard Metro bundler.
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  server: {
    port: 8082, // Vendor app uses port 8082 to avoid conflicts
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
