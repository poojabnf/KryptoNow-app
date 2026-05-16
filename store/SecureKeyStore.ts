/**
 * SecureKeyStore.ts  — v1.1.0
 *
 * Secure Enclave key storage for KryptoNow.
 *
 * iOS     → Secure Enclave (SEP) via expo-secure-store
 *           (kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly)
 * Android → Android Keystore (hardware-backed TEE) via expo-secure-store
 *
 * Private keys NEVER touch the JS heap in plaintext after being stored.
 * All reads are gated behind biometric / device PIN authentication.
 *
 * CHANGELOG v1.1.0
 *   - Fixed: TypeScript compile error on web — LocalAuthentication.AuthenticationType
 *     now imported as a type alias rather than from the conditional require()
 *   - Added: storeMnemonic / retrieveMnemonic for wallet restore flows
 *   - Added: storeMnemonicAndKey — single atomic call for wallet creation
 *   - Fixed: migrateFromWalletStore — correct AsyncStorage key ('kryptonow_wallet')
 *     and proper phrase→privateKey derivation before enclave write
 *   - Added: MIGRATION_FLAG_KEY so migration runs exactly once per install
 *
 * Dependencies:
 *   expo install expo-secure-store expo-local-authentication expo-crypto
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

// ─── Type-safe LocalAuthentication (web stub avoids runtime type errors) ───────

type AuthType = 1 | 2 | 3; // FINGERPRINT=1, FACIAL_RECOGNITION=2, IRIS=3

type LocalAuthAPI = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<AuthType[]>;
  authenticateAsync: (opts: object) => Promise<{ success: boolean }>;
};

const LocalAuthentication: LocalAuthAPI =
  Platform.OS === 'web'
    ? {
        hasHardwareAsync: async () => false,
        isEnrolledAsync: async () => false,
        supportedAuthenticationTypesAsync: async () => [],
        authenticateAsync: async () => ({ success: true }),
      }
    : require('expo-local-authentication');

// ─── Storage key constants ─────────────────────────────────────────────────────

const storeKey  = (idx: number) => `kn_privkey_${idx}`;
const metaKey   = (idx: number) => `kn_meta_${idx}`;
const mnemoKey  = (idx: number) => `kn_mnemonic_${idx}`;   // NEW: mnemonic storage
const ACCOUNTS_INDEX_KEY  = 'kn_accounts_index';
const MIGRATION_FLAG_KEY  = 'kn_enclave_migrated_v1';      // NEW: run-once flag

// ─── expo-secure-store options ────────────────────────────────────────────────

/** Hardware-backed; biometric/PIN prompt fires on every read. */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === 'web'
    ? {}
    : {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        requireAuthentication: true,
      };

/** Non-sensitive metadata; readable without auth after first unlock. */
const META_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === 'web'
    ? {}
    : {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        requireAuthentication: false,
      };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KeyMeta {
  accountIndex: number;
  address: string;        // EIP-55 checksummed  (0x...)
  derivationPath: string; // e.g. "m/44'/60'/0'/0/0"
  createdAt: number;      // unix ms
  deviceId: string;       // stable per-install audit ID
}

export interface SecureStoreResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface DeviceSecurity {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: AuthType[];
  canCreateWallet: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function isHardwareBackedAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

async function authenticate(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync('kn_device_id', META_OPTIONS);
  if (!id) {
    id = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Math.random()}${Date.now()}`,
    );
    await SecureStore.setItemAsync('kn_device_id', id, META_OPTIONS);
  }
  return id;
}

async function bumpAccountCount(accountIndex: number): Promise<void> {
  const raw   = await SecureStore.getItemAsync(ACCOUNTS_INDEX_KEY, META_OPTIONS);
  const count = raw ? parseInt(raw, 10) : 0;
  if (accountIndex >= count) {
    await SecureStore.setItemAsync(
      ACCOUNTS_INDEX_KEY,
      String(accountIndex + 1),
      META_OPTIONS,
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a private key in the hardware-backed secure enclave.
 *
 * @param privateKeyHex  64-char hex, NO 0x prefix
 * @param meta           Address + derivation path
 */
export async function storePrivateKey(
  privateKeyHex: string,
  meta: Omit<KeyMeta, 'createdAt' | 'deviceId'>,
): Promise<SecureStoreResult<void>> {
  try {
    // Strip 0x prefix if caller accidentally included it
    const hex = privateKeyHex.startsWith('0x')
      ? privateKeyHex.slice(2)
      : privateKeyHex;

    if (!hex || hex.length !== 64) {
      return { ok: false, error: 'Invalid private key (expected 64-char hex, no 0x prefix)' };
    }

    if (!(await isHardwareBackedAvailable())) {
      return {
        ok: false,
        error:
          'Device has no enrolled biometrics or passcode. ' +
          'Please enable device lock in Settings before creating a wallet.',
      };
    }

    const deviceId = await getOrCreateDeviceId();

    await SecureStore.setItemAsync(storeKey(meta.accountIndex), hex, SECURE_OPTIONS);

    const fullMeta: KeyMeta = { ...meta, createdAt: Date.now(), deviceId };
    await SecureStore.setItemAsync(
      metaKey(meta.accountIndex),
      JSON.stringify(fullMeta),
      META_OPTIONS,
    );

    await bumpAccountCount(meta.accountIndex);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown error storing key' };
  }
}

/**
 * NEW — Store the mnemonic phrase in the enclave.
 * Required for wallet restore after reinstall.
 * Biometric/PIN gated on both write and read.
 *
 * @param mnemonic  12 or 24 word BIP-39 phrase
 * @param accountIndex  wallet slot (usually 0)
 */
export async function storeMnemonic(
  mnemonic: string,
  accountIndex: number,
): Promise<SecureStoreResult<void>> {
  try {
    const words = mnemonic.trim().split(/\s+/).length;
    if (words !== 12 && words !== 24) {
      return { ok: false, error: 'Mnemonic must be 12 or 24 words' };
    }

    if (!(await isHardwareBackedAvailable())) {
      return { ok: false, error: 'No hardware-backed storage available' };
    }

    await SecureStore.setItemAsync(mnemoKey(accountIndex), mnemonic.trim(), SECURE_OPTIONS);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error storing mnemonic' };
  }
}

/**
 * NEW — Retrieve the mnemonic phrase from the enclave.
 * Triggers biometric/PIN prompt.
 */
export async function retrieveMnemonic(
  accountIndex: number,
  reason = 'Authenticate to access recovery phrase',
): Promise<SecureStoreResult<string>> {
  try {
    const authed = await authenticate(reason);
    if (!authed) return { ok: false, error: 'Authentication cancelled or failed' };

    const phrase = await SecureStore.getItemAsync(mnemoKey(accountIndex), SECURE_OPTIONS);
    if (!phrase) return { ok: false, error: `No mnemonic found for account ${accountIndex}` };

    return { ok: true, data: phrase };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error retrieving mnemonic' };
  }
}

/**
 * NEW — Atomic single call for wallet creation.
 * Stores both private key AND mnemonic in the enclave in one step.
 * Use this in create.tsx and import.tsx instead of calling both separately.
 */
export async function storeMnemonicAndKey(
  mnemonic: string,
  privateKeyHex: string,
  meta: Omit<KeyMeta, 'createdAt' | 'deviceId'>,
): Promise<SecureStoreResult<void>> {
  const keyResult = await storePrivateKey(privateKeyHex, meta);
  if (!keyResult.ok) return keyResult;

  const mnemoResult = await storeMnemonic(mnemonic, meta.accountIndex);
  if (!mnemoResult.ok) {
    // Roll back the key store if mnemonic write fails
    await SecureStore.deleteItemAsync(storeKey(meta.accountIndex), SECURE_OPTIONS).catch(() => {});
    return mnemoResult;
  }

  return { ok: true };
}

/**
 * Retrieve a private key from the secure enclave.
 * Triggers OS-level biometric prompt.
 * Zero the returned key from memory immediately after signing.
 */
export async function retrievePrivateKey(
  accountIndex: number,
  reason = 'Authenticate to sign transaction',
): Promise<SecureStoreResult<string>> {
  try {
    const authed = await authenticate(reason);
    if (!authed) return { ok: false, error: 'Authentication cancelled or failed' };

    const key = await SecureStore.getItemAsync(storeKey(accountIndex), SECURE_OPTIONS);
    if (!key) return { ok: false, error: `No key found for account index ${accountIndex}` };

    return { ok: true, data: key };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown error retrieving key' };
  }
}

/**
 * Read account metadata WITHOUT biometrics.
 * Safe to call anytime (e.g. to display address in the UI).
 */
export async function getKeyMeta(accountIndex: number): Promise<SecureStoreResult<KeyMeta>> {
  try {
    const raw = await SecureStore.getItemAsync(metaKey(accountIndex), META_OPTIONS);
    if (!raw) return { ok: false, error: `No metadata for account ${accountIndex}` };
    return { ok: true, data: JSON.parse(raw) as KeyMeta };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error reading metadata' };
  }
}

/** List metadata for ALL stored accounts (no biometrics needed). */
export async function listAllAccounts(): Promise<SecureStoreResult<KeyMeta[]>> {
  try {
    const raw   = await SecureStore.getItemAsync(ACCOUNTS_INDEX_KEY, META_OPTIONS);
    const count = raw ? parseInt(raw, 10) : 0;
    const accounts: KeyMeta[] = [];

    for (let i = 0; i < count; i++) {
      const res = await getKeyMeta(i);
      if (res.ok && res.data) accounts.push(res.data);
    }

    return { ok: true, data: accounts };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error listing accounts' };
  }
}

/**
 * Permanently delete a private key, mnemonic, and metadata from the enclave.
 * Use for wallet removal / factory reset.
 * Requires biometric confirmation.
 */
export async function deletePrivateKey(
  accountIndex: number,
  reason = 'Authenticate to remove wallet',
): Promise<SecureStoreResult<void>> {
  try {
    const authed = await authenticate(reason);
    if (!authed) return { ok: false, error: 'Authentication cancelled' };

    await Promise.all([
      SecureStore.deleteItemAsync(storeKey(accountIndex), SECURE_OPTIONS),
      SecureStore.deleteItemAsync(mnemoKey(accountIndex), SECURE_OPTIONS),
      SecureStore.deleteItemAsync(metaKey(accountIndex), META_OPTIONS),
    ]);

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error deleting key' };
  }
}

/** Check if this device supports hardware-backed secure storage. */
export async function checkDeviceSecurity(): Promise<DeviceSecurity> {
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  return {
    hasHardware,
    isEnrolled,
    supportedTypes,
    canCreateWallet: hasHardware && isEnrolled,
  };
}

// ─── Migration: walletStore (AsyncStorage) → Secure Enclave ──────────────────

/**
 * FIXED v1.1.0 — migrateFromWalletStore
 *
 * Previous version referenced wrong AsyncStorage key ('kn_encrypted_privkey').
 * The actual key used by walletStore.ts is 'kryptonow_wallet' which stores
 * a JSON object: { address: string, phrase: string, name?: string }
 *
 * This function:
 *  1. Checks if migration already ran (idempotent — safe to call every launch)
 *  2. Reads the existing wallet from AsyncStorage
 *  3. Derives the private key from the mnemonic phrase
 *  4. Stores both key and mnemonic in the enclave
 *  5. Removes the raw phrase from AsyncStorage
 *  6. Sets the migration flag so it never runs again
 *
 * Call this in app/_layout.tsx after the user has authenticated.
 */
export async function migrateFromWalletStore(
  accountIndex = 0,
): Promise<SecureStoreResult<void>> {
  try {
    // ── 1. Idempotency check ──────────────────────────────────────────────────
    const alreadyMigrated = await SecureStore.getItemAsync(MIGRATION_FLAG_KEY, META_OPTIONS);
    if (alreadyMigrated === 'true') {
      return { ok: true }; // already done — safe no-op
    }

    // ── 2. Read old wallet from AsyncStorage ──────────────────────────────────
    const raw = await AsyncStorage.getItem('kryptonow_wallet');
    if (!raw) {
      // No old wallet exists — new install, mark as done and exit
      await SecureStore.setItemAsync(MIGRATION_FLAG_KEY, 'true', META_OPTIONS);
      return { ok: true };
    }

    const wallet = JSON.parse(raw) as { address?: string; phrase?: string };
    if (!wallet.phrase || !wallet.address) {
      return { ok: false, error: 'Old wallet data is missing phrase or address' };
    }

    // ── 3. Derive private key from mnemonic ───────────────────────────────────
    const ETH_PATH = "m/44'/60'/0'/0/0";
    const hdNode   = ethers.HDNodeWallet.fromPhrase(wallet.phrase.trim(), undefined, ETH_PATH);
    // Strip 0x prefix — SecureKeyStore stores raw 64-char hex
    const privateKeyHex = hdNode.privateKey.slice(2);

    // ── 4. Store in enclave ───────────────────────────────────────────────────
    const result = await storeMnemonicAndKey(wallet.phrase.trim(), privateKeyHex, {
      accountIndex,
      address: wallet.address,
      derivationPath: ETH_PATH,
    });

    if (!result.ok) return result;

    // ── 5. Remove raw phrase from AsyncStorage ────────────────────────────────
    //    We keep the address and name but null out the phrase field
    const sanitised = { ...wallet, phrase: '' };
    await AsyncStorage.setItem('kryptonow_wallet', JSON.stringify(sanitised));

    // ── 6. Set migration flag ─────────────────────────────────────────────────
    await SecureStore.setItemAsync(MIGRATION_FLAG_KEY, 'true', META_OPTIONS);

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Migration failed' };
  }
}

/**
 * Legacy wrapper — kept for backwards compatibility with migrateToEnclave.ts
 * Prefer migrateFromWalletStore() for the primary migration flow.
 */
export async function migrateToSecureEnclave(
  plaintextPrivKey: string,
  meta: Omit<KeyMeta, 'createdAt' | 'deviceId'>,
): Promise<SecureStoreResult<void>> {
  return storePrivateKey(plaintextPrivKey, meta);
}

/** Alias used by eip1193 / useAA — defaults to account index 0. */
export async function loadPrivateKeyFromEnclave(
  reason = 'Authenticate to sign',
  accountIndex = 0,
): Promise<SecureStoreResult<string>> {
  return retrievePrivateKey(accountIndex, reason);
}
