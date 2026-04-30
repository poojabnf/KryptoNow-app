/**
 * keyStore.ts
 * -----------
 * Stores private key + seed phrase in the device's secure enclave.
 * Uses expo-secure-store on native and AsyncStorage on web (dev only —
 * never store real keys in AsyncStorage for production web).
 */
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PRIVKEY_KEY = 'kryptonow_privkey'
const PHRASE_KEY  = 'kryptonow_phrase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Web fallback — not secure, fine for local dev
    await AsyncStorage.setItem(key, value)
    return
  }
  const SecureStore = await import('expo-secure-store')
  await SecureStore.setItemAsync(key, value)
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key)
  }
  const SecureStore = await import('expo-secure-store')
  return SecureStore.getItemAsync(key)
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key)
    return
  }
  const SecureStore = await import('expo-secure-store')
  await SecureStore.deleteItemAsync(key)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveWalletKeys(privateKey: string, phrase: string): Promise<void> {
  await secureSet(PRIVKEY_KEY, privateKey)
  await secureSet(PHRASE_KEY, phrase)
}

export async function loadPrivateKey(): Promise<string | null> {
  return secureGet(PRIVKEY_KEY)
}

export async function loadPhrase(): Promise<string | null> {
  return secureGet(PHRASE_KEY)
}

export async function deleteWalletKeys(): Promise<void> {
  await secureDelete(PRIVKEY_KEY)
  await secureDelete(PHRASE_KEY)
}
