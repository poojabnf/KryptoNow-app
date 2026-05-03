/**
 * utils/storage.ts
 * ----------------
 * Unified cross-platform storage.
 * - Native (iOS/Android): expo-secure-store for sensitive, AsyncStorage for general
 * - Web: localStorage for general, sessionStorage fallback
 *
 * Use:
 *   import { storage } from '../utils/storage'
 *   await storage.set('key', 'value')
 *   await storage.get('key')
 *   await storage.remove('key')
 */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Keys that must be stored securely (hardware-encrypted)
const SECURE_KEYS = new Set([
  'kryptonow_vault',
  'kryptonow_pk',
  'kryptonow_private_key',
  'kryptonow_mnemonic',
])

function isSecure(key: string): boolean {
  return SECURE_KEYS.has(key)
}

// Sanitize key for SecureStore (only alphanumeric + . - _)
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS !== 'web' && isSecure(key)) {
        return await SecureStore.getItemAsync(sanitizeKey(key))
      }
      if (Platform.OS !== 'web') {
        return await AsyncStorage.getItem(key)
      }
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS !== 'web' && isSecure(key)) {
        await SecureStore.setItemAsync(sanitizeKey(key), value)
        return
      }
      if (Platform.OS !== 'web') {
        await AsyncStorage.setItem(key, value)
        return
      }
      localStorage.setItem(key, value)
    } catch {}
  },

  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS !== 'web' && isSecure(key)) {
        await SecureStore.deleteItemAsync(sanitizeKey(key))
        return
      }
      if (Platform.OS !== 'web') {
        await AsyncStorage.removeItem(key)
        return
      }
      localStorage.removeItem(key)
    } catch {}
  },

  async clear(): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await AsyncStorage.clear()
        return
      }
      localStorage.clear()
    } catch {}
  },

  async keys(): Promise<string[]> {
    try {
      if (Platform.OS !== 'web') {
        const keys = await AsyncStorage.getAllKeys()
        return [...keys] as string[]
      }
      return Object.keys(localStorage)
    } catch {
      return []
    }
  },
}

// Sync helpers for web-only code paths (walletStore initializes synchronously)
export const storageSync = {
  get(key: string): string | null {
    try {
      if (Platform.OS !== 'web') return null // native needs async path
      return localStorage.getItem(key)
    } catch { return null }
  },
  set(key: string, value: string): void {
    try {
      if (Platform.OS !== 'web') return
      localStorage.setItem(key, value)
    } catch {}
  },
  remove(key: string): void {
    try {
      if (Platform.OS !== 'web') return
      localStorage.removeItem(key)
    } catch {}
  },
}
