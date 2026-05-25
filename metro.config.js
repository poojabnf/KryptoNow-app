/**
 * Root monorepo metro.config.js — used by EAS when it detects workspaces.
 *
 * Problem: EAS runs `expo export` from the monorepo root using root's expo CLI.
 * Root's babel-preset-expo calls `require.resolve('expo-router')` which fails
 * (expo-router is only in mobile/node_modules), so expoRouterBabelPlugin is never
 * registered, and `process.env.EXPO_ROUTER_APP_ROOT` in _ctx.ios.js is never
 * replaced with a static string — Metro then rejects the require.context() call.
 *
 * Fix: intercept `expo-router/_ctx` resolution and redirect to pre-resolved
 * ctx files in mobile/ that already have `'./app'` hardcoded as a static string.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const monorepoRoot = __dirname;
const projectRoot  = path.join(monorepoRoot, 'mobile');

const config = getDefaultConfig(projectRoot);

// Watch both the mobile project and the monorepo root
config.watchFolders = [monorepoRoot];

// Look in mobile/node_modules FIRST, then root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Intercept expo-router/_ctx resolves and redirect to pre-resolved files in mobile/.
// These files have the app path hardcoded as a static string so Metro accepts them.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect expo-router/_ctx to our pre-resolved ctx files
  if (moduleName === 'expo-router/_ctx') {
    const ctxMap = {
      ios:     path.join(projectRoot, 'expo-router-ctx-ios.js'),
      android: path.join(projectRoot, 'expo-router-ctx-android.js'),
      web:     path.join(projectRoot, 'expo-router-ctx-web.js'),
    };
    const ctxFile = ctxMap[platform] || ctxMap.android;
    return { type: 'sourceFile', filePath: ctxFile };
  }

  // Stub permissionless + viem on web (AA is native-only)
  if (
    platform === 'web' &&
    (moduleName === 'permissionless' ||
     moduleName.startsWith('permissionless/') ||
     moduleName === 'viem' ||
     moduleName.startsWith('viem/'))
  ) {
    return { type: 'empty' };
  }

  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
