// Pre-resolved expo-router ctx for iOS — bypasses monorepo babel-transform issue.
// EXPO_ROUTER_APP_ROOT + EXPO_ROUTER_IMPORT_MODE are hardcoded here instead of
// being inlined by babel-plugin-expo-router (which can't run when babel-preset-expo
// is hoisted to the monorepo root and can't resolve expo-router via require.resolve).
export const ctx = require.context(
  './app',
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.android|\.web)?\.[tj]sx?$/,
  'sync'
);
