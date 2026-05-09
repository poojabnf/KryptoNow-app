/**
 * store/SecureKeyStore.ts
 * Compatibility shim  all logic lives in keyStore.ts
 * This file exists only to avoid breaking existing imports.
 */
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { savePrivateKey, loadPrivateKey, deletePrivateKey } from './keyStore'

export { savePrivateKey, loadPrivateKey, deletePrivateKey }

// Alias used by hooks/useAA.ts and hooks/eip1193.ts
export const loadPrivateKeyFromEnclave = loadPrivateKey
export const savePrivateKeyToEnclave   = savePrivateKey

// Used by hooks/migrateToEnclave.ts
export async function migrateToSecureEnclave(): Promise<{ ok: boolean; error?: any }> {
  try {
    if (Platform.OS === 'web') return { ok: true }
    const legacyKey = await AsyncStorage.getItem('kryptonow_vault')
    if (legacyKey) {
      await savePrivateKey(legacyKey)
      await AsyncStorage.removeItem('kryptonow_vault')
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

// Used by app/_layout.tsx
export async function migrateFromWalletStore(retryCount = 0): Promise<{ ok: boolean; error?: any }> {
  return migrateToSecureEnclave()
}
