const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('./bom-strip-transformer.js'),
};

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    const webStubs = {
      'expo-auth-session': path.resolve(__dirname, 'stubs/expo-auth-session.js'),
      'react-native-get-random-values': path.resolve(__dirname, 'stubs/react-native-get-random-values.js'),
    };
    if (platform === 'web' && webStubs[moduleName]) {
      return { filePath: webStubs[moduleName], type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;