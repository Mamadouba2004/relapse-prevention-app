const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect expo-sqlite to a no-op web stub when bundling for web.
// All SQLite usage in the app is already guarded with Platform.OS checks,
// so the stub is never called at runtime — this just prevents the Metro
// bundler from trying to process the WASM file that expo-sqlite requires.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'expo-sqlite' || moduleName.startsWith('expo-sqlite/'))
  ) {
    return {
      filePath: path.resolve(__dirname, 'stubs/expo-sqlite-web.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
