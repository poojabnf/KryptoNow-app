/**
 * mobile/metro.config.js
 *
 * Root cause of EAS Update failure in monorepo:
 *   babel-preset-expo is hoisted to root/node_modules.
 *   Its `hasModule('expo-router')` check uses require.resolve from the root,
 *   where expo-router is NOT installed → expoRouterBabelPlugin never runs →
 *   `process.env.EXPO_ROUTER_APP_ROOT` in expo-router/_ctx.ios.js stays dynamic →
 *   Metro's require.context() rejects it with "first arg must be a string".
 *
 * Fix: intercept `expo-router/_ctx` resolution and return pre-built ctx files
 * that already have `'./app'` hardcoded as a static string.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const appRoot     = path.resolve(projectRoot, 'app');

// Keep setting this in case a future expo-router version reads it differently
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const config = getDefaultConfig(projectRoot);

// Redirect expo-router/_ctx to our pre-resolved ctx shims.
// These shims have `'./app'` hardcoded so Metro sees a static string.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-router/_ctx') {
    const ctxMap = {
      ios:     path.join(projectRoot, 'expo-router-ctx-ios.js'),
      android: path.join(projectRoot, 'expo-router-ctx-android.js'),
      web:     path.join(projectRoot, 'expo-router-ctx-web.js'),
    };
    const ctxFile = ctxMap[platform] || path.join(projectRoot, 'expo-router-ctx-android.js');
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
