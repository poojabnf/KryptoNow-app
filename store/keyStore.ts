/**
 * store/keyStore.ts
 * -----------------
 * Secure private key storage.
 * Native: expo-secure-store (hardware-backed keychain/keystore)
 * Web:    localStorage with AES encryption (existing vault pattern)
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const NATIVE_KEY = 'kryptonow_vault'
const WEB_KEY    = 'kryptonow_vault'

async function saveNative(value: string): Promise<void> {
  await SecureStore.setItemAsync(NATIVE_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

async function loadNative(): Promise<string | null> {
  return SecureStore.getItemAsync(NATIVE_KEY)
}

async function deleteNative(): Promise<void> {
  await SecureStore.deleteItemAsync(NATIVE_KEY)
}

// --- Public API ---------------------------------------------------------------

export async function savePrivateKey(encryptedVault: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await saveNative(encryptedVault)
  } else {
    try { localStorage.setItem(WEB_KEY, encryptedVault) } catch {}
  }
}

export async function loadPrivateKey(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    return loadNative()
  }
  try { return localStorage.getItem(WEB_KEY) } catch { return null }
}

export async function deletePrivateKey(): Promise<void> {
  if (Platform.OS !== 'web') {
    await deleteNative()
  } else {
    try { localStorage.removeItem(WEB_KEY) } catch {}
  }
}

/** Save private key (and optionally derive address from mnemonic elsewhere). */
export async function saveWalletKeys(privateKey: string, _mnemonic?: string): Promise<void> {
  await savePrivateKey(privateKey)
}

// Alias for backwards compat
export const saveVault  = savePrivateKey
export const loadVault  = loadPrivateKey
export const deleteVault = deletePrivateKey
