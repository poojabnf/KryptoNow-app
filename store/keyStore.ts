/**
 * store/keyStore.ts
 * -----------------
 * ✅ Bug 2 fix: was two conflicting files (keyStore.ts + SecureKeyStore.ts)
 * with different key names (kryptonow_vault vs kryptonow_vault_pk).
 * Consolidated into one file with consistent keys.
 *
 * DELETE store/SecureKeyStore.ts after applying this fix.
 *
 * Native: expo-secure-store (hardware-backed keychain/keystore)
 * Web:    AsyncStorage fallback (dev only — never store real keys in prod web)
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Single source of truth for key names
const KEY_PRIVKEY = 'kryptonow_privkey'
const KEY_PHRASE  = 'kryptonow_phrase'

// ── Native helpers ────────────────────────────────────────────────
async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key)
}

async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}

// ── Web helpers ───────────────────────────────────────────────────
async function webSet(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value)
}

async function webGet(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key)
}

async function webDelete(key: string): Promise<void> {
  await AsyncStorage.removeItem(key)
}

// ── Public API ────────────────────────────────────────────────────

/** Save private key + seed phrase to secure storage */
export async function saveWalletKeys(privateKey: string, phrase: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await secureSet(KEY_PRIVKEY, privateKey)
    await secureSet(KEY_PHRASE,  phrase)
  } else {
    await webSet(KEY_PRIVKEY, privateKey)
    await webSet(KEY_PHRASE,  phrase)
  }
}

/** Load private key from secure storage */
export async function loadPrivateKey(): Promise<string | null> {
  return Platform.OS !== 'web' ? secureGet(KEY_PRIVKEY) : webGet(KEY_PRIVKEY)
}

/** Load seed phrase from secure storage */
export async function loadPhrase(): Promise<string | null> {
  return Platform.OS !== 'web' ? secureGet(KEY_PHRASE) : webGet(KEY_PHRASE)
}

/** Wipe all stored keys (on sign-out / wallet removal) */
export async function deleteWalletKeys(): Promise<void> {
  if (Platform.OS !== 'web') {
    await secureDelete(KEY_PRIVKEY)
    await secureDelete(KEY_PHRASE)
  } else {
    await webDelete(KEY_PRIVKEY)
    await webDelete(KEY_PHRASE)
  }
}

// Aliases for backwards compatibility with old SecureKeyStore imports
export const savePrivateKey  = (pk: string) => saveWalletKeys(pk, '')
export const getPrivateKey   = loadPrivateKey
export const deletePrivateKey = deleteWalletKeys
export const saveVault       = saveWalletKeys
export const loadVault       = loadPrivateKey
export const deleteVault     = deleteWalletKeys
