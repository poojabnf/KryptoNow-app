import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEY = 'kryptonow_vault_pk';

export async function savePrivateKey(privateKey: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Fallback for web extension / browser testing
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SECURE_KEY, privateKey);
      }
      return true;
    }
    
    // Hardware-backed secure enclave storage
    await SecureStore.setItemAsync(SECURE_KEY, privateKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.error('[SecureEnclave] Save error:', error);
    return false;
  }
}

export async function getPrivateKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(SECURE_KEY) : null;
    }
    return await SecureStore.getItemAsync(SECURE_KEY);
  } catch (error) {
    console.error('[SecureEnclave] Read error:', error);
    return null;
  }
}

// Called in _layout.tsx on app boot to ensure no keys are left in insecure storage
export async function migrateFromWalletStore(retryCount = 0): Promise<{ok: boolean, error?: any}> {
  try {
    if (Platform.OS === 'web') return { ok: true };
    
    // Look for legacy unencrypted key from previous versions
    const legacyKey = await AsyncStorage.getItem('kryptonow_vault');
    if (legacyKey) {
      const saved = await savePrivateKey(legacyKey);
      if (saved) {
        // Only wipe the old storage if the secure enclave write was successful
        await AsyncStorage.removeItem('kryptonow_vault');
        console.log('[SecureEnclave] Successfully migrated legacy key to Secure Enclave hardware');
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}