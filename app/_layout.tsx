import * as WebBrowser from 'expo-web-browser'
if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession()
}
import ApprovalModal from '../components/ApprovalModal'
import { kryptoNowProvider } from '../utils/eip1193'
import 'react-native-get-random-values';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { migrateFromWalletStore } from '../store/SecureKeyStore';
import { Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { LockProvider } from '../context/LockContext';
import { Platform } from 'react-native';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

// @ts-ignore
const tokenCache = Platform.OS === 'web'
  ? {
      async getToken(key: string) {
        try { if (typeof localStorage !== 'undefined') return localStorage.getItem(key); return null } catch { return null }
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
        try { return await SecureStore.getItemAsync(key) } catch { return null }
      },
      async setToken(key: string, value: string) {
        try { await SecureStore.setItemAsync(key, value) } catch {}
      },
      async deleteToken(key: string) {
        try { await SecureStore.deleteItemAsync(key) } catch {}
      },
    }

function RootLayoutNav() {
  const { isLoaded } = useAuth()
  const address      = useWalletStore(s => s.address)
  const activeChain  = useWalletStore(s => s.activeChain)

  // Keep EIP-1193 provider in sync with active wallet + chain
  useEffect(() => {
    if (address && activeChain) {
      kryptoNowProvider.init(address, activeChain.id, activeChain.rpc)
    }
  }, [address, activeChain?.id])

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D2E2E' }}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {/* ApprovalModal sits above everything  fires when dApps request signing */}
      <ApprovalModal />
    </View>
  )
}

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const initFromStorage = useWalletStore(s => s.initFromStorage)

  useEffect(() => {
    initFromStorage()
    if (Platform.OS !== 'web') {
      migrateFromWalletStore(0).then(r => {
        if (!r.ok) console.warn('[KryptoNow] Enclave migration:', r.error)
        else console.log('[KryptoNow] Enclave migration: OK')
      })
    }
  }, [])

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache as any}
      after
      after
    >
      <ThemeProvider>
        <LockProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </LockProvider>
      </ThemeProvider>
    </ClerkProvider>
  )
}

