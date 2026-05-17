const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Stub permissionless + viem for web builds (AA is native-only)
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'permissionless' ||
     moduleName.startsWith('permissionless/') ||
     moduleName === 'viem' ||
     moduleName.startsWith('viem/'))
  ) {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
