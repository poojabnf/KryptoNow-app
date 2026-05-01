import 'react-native-get-random-values';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { AuthProvider } from '../context/AuthContext';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

import { Platform } from 'react-native';
const tokenCache = Platform.OS === 'web'
  ? {
      async getToken(key: string) {
        try { return localStorage.getItem(key); } catch { return null; }
      },
      async setToken(key: string, value: string) {
        try { localStorage.setItem(key, value); } catch {}
      },
      async deleteToken(key: string) {
        try { localStorage.removeItem(key); } catch {}
      },
    }
  : {
      async getToken(key: string) {
        try { return await SecureStore.getItemAsync(key); } catch { return null; }
      },
      async setToken(key: string, value: string) {
        try { await SecureStore.setItemAsync(key, value); } catch {}
      },
      async deleteToken(key: string) {
        try { await SecureStore.deleteItemAsync(key); } catch {}
      },
    };

function RootLayoutNav() {
  const { isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D2E2E' }}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }
  return <Slot />;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ClerkProvider>
  );
}
