// ⚠️  This MUST be the first import — it patches StyleSheet.create on web
// before Expo Router lazily loads any screen module.
import { applyWebShadowPatch } from '../utils/webShadowPatch';
applyWebShadowPatch();

import { ClerkProvider } from "@clerk/expo";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useWalletStore } from "../store/walletStore";

// expo-secure-store (used by @clerk/expo/token-cache) is NOT available on web.
// Passing tokenCache={undefined} on web lets Clerk use cookie-based sessions,
// which is what it needs for browser OAuth (Google / Discord).
function getTokenCache() {
  if (Platform.OS === "web") return undefined;
  const { tokenCache } = require("@clerk/expo/token-cache");
  return tokenCache;
}

// maybeCompleteAuthSession is only meaningful on native — it closes the
// in-app browser after an OAuth redirect. On web Clerk handles the redirect
// itself; calling this unconditionally can interfere with the OAuth flow.
if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

function WalletBootstrap() {
  const initFromStorage = useWalletStore(s => s.initFromStorage)
  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])
  return null
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={getTokenCache()}
    >
      <WalletBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}
