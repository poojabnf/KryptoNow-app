// ⚠️  This MUST be the first import — it patches StyleSheet.create on web
// before Expo Router lazily loads any screen module.
import { applyWebShadowPatch } from '../utils/webShadowPatch';
applyWebShadowPatch();

import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useWalletStore } from "../store/walletStore";
import Purchases from "react-native-purchases";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AuthProvider } from "../context/AuthContext";

// maybeCompleteAuthSession is required on ALL platforms when using expo-auth-session.
// It detects the redirect and closes the popup browser automatically.
WebBrowser.maybeCompleteAuthSession();

function WalletBootstrap() {
  const initFromStorage = useWalletStore(s => s.initFromStorage)
  useEffect(() => {
    initFromStorage()
    // Initialise RevenueCat on native platforms only
    if (Platform.OS !== 'web') {
      const rcKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY
      if (rcKey) Purchases.configure({ apiKey: rcKey })
    }
  }, [initFromStorage])
  return null
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <WalletBootstrap />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
    </AuthProvider>
  );
}
