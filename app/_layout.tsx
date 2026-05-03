import ApprovalModal from '../components/ApprovalModal'
import { kryptoNowProvider } from '../utils/eip1193'
import 'react-native-get-random-values';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

import { Platform } from 'react-native';
const tokenCache = Platform.OS === 'web'
  ? {
      async getToken(key: string) {
        try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
    return null
  } catch { return null }
      },
      async setToken(key: string, value: string) {
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) } catch {}
      },
      async deleteToken(key: string) {
        try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key) } catch {}
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
  console.log("[KryptoNow] isLoaded:", isLoaded, "key:", process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.slice(0,20));
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
  const initFromStorage = useWalletStore(s => s.initFromStorage)

  useEffect(() => {
    initFromStorage()
  }, [])

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
