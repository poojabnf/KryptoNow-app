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
import { ethers } from 'ethers'
import { retrievePrivateKey, storePrivateKey, deletePrivateKey as deleteEnclaveKey } from './SecureKeyStore'
import { useWalletStore } from './walletStore'

const WEB_KEY = 'kryptonow_vault'

// --- Public API ---------------------------------------------------------------

export async function savePrivateKey(privateKey: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const cleanKey = privateKey.replace('0x', '')
    const w = new ethers.Wallet('0x' + cleanKey)
    const activeIdx = useWalletStore.getState().activeAccountIndex ?? 0
    await storePrivateKey(cleanKey, {
      accountIndex: activeIdx,
      address: w.address,
      derivationPath: `m/44'/60'/0'/0/${activeIdx}`
    })
  } else {
    try { localStorage.setItem(WEB_KEY, privateKey) } catch {}
  }
}

export async function loadPrivateKey(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const activeIdx = useWalletStore.getState().activeAccountIndex ?? 0
    const res = await retrievePrivateKey(activeIdx)
    return res.ok && res.data ? '0x' + res.data : null
  }
  try { return localStorage.getItem(WEB_KEY) } catch { return null }
}

export async function deletePrivateKey(): Promise<void> {
  if (Platform.OS !== 'web') {
    const activeIdx = useWalletStore.getState().activeAccountIndex ?? 0
    await deleteEnclaveKey(activeIdx)
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
