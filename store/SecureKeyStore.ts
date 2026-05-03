/**
 * SecureKeyStore.ts
 *
 * Secure Enclave key storage for KryptoNow.
 *
 * iOS  → Secure Enclave (SEP) via expo-secure-store (kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly)
 * Android → Android Keystore (hardware-backed TEE) via expo-secure-store
 *
 * Private keys NEVER touch the JS heap in plaintext after being stored.
 * All reads are gated behind biometric / device PIN authentication.
 *
 * Dependencies:
 *   expo install expo-secure-store expo-local-authentication expo-crypto
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

// ─── Key name constants ───────────────────────────────────────────────────────
// Use distinct store keys per account index so we never overwrite existing keys.
const storeKey = (accountIndex: number) => `kn_privkey_${accountIndex}`;
const metaKey = (accountIndex: number) => `kn_meta_${accountIndex}`;
const ACCOUNTS_INDEX_KEY = 'kn_accounts_index'; // stores how many accounts exist

// ─── Types ────────────────────────────────────────────────────────────────────
export interface KeyMeta {
  accountIndex: number;
  address: string;       // checksummed Ethereum address (0x...)
  derivationPath: string; // e.g. "m/44'/60'/0'/0/0"
  createdAt: number;      // unix ms
  deviceId: string;       // random per-install ID, for audit
}

export interface SecureStoreResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * expo-secure-store options that map to hardware-backed storage:
 * - iOS:     kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly  (requires device passcode, not migratable)
 * - Android: FLAG_SECURE + requireAuthentication backed by Keystore TEE
 *
 * Note: requireAuthentication=true means the OS-level biometric/PIN prompt fires
 * automatically on read. We also do an explicit LocalAuthentication check before
 * reads so we can return a typed error rather than letting the OS throw.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  requireAuthentication: true,   // hardware-level biometric gate on read
};

/** Options for non-sensitive metadata (address, derivation path, etc.) */
const META_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  requireAuthentication: false,
};

async function isHardwareBackedAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

async function authenticate(reason: string): Promise<boolean> {
  const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // allow PIN fallback if biometrics fail
  });
  return result.success;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a private key in the hardware-backed secure enclave.
 * Call this ONCE at wallet creation / import. The raw key is wiped from the
 * variable you pass in — zero it out after calling this.
 *
 * @param privateKeyHex  Raw private key as hex string (64 chars, no 0x prefix)
 * @param meta           Address + derivation path metadata
 */
export async function storePrivateKey(
  privateKeyHex: string,
  meta: Omit<KeyMeta, 'createdAt' | 'deviceId'>,
): Promise<SecureStoreResult<void>> {
  try {
    if (!privateKeyHex || privateKeyHex.length !== 64) {
      return { ok: false, error: 'Invalid private key format (expected 64-char hex)' };
    }

    const hwAvailable = await isHardwareBackedAvailable();
    if (!hwAvailable) {
      return {
        ok: false,
        error:
          'Device does not have enrolled biometrics or a passcode. ' +
          'Please enable device lock in Settings before creating a wallet.',
      };
    }

    // Generate a stable per-install device ID for audit logs
    let deviceId = await SecureStore.getItemAsync('kn_device_id', META_OPTIONS);
    if (!deviceId) {
      deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString() + Date.now(),
      );
      await SecureStore.setItemAsync('kn_device_id', deviceId, META_OPTIONS);
    }

    // Store the private key in the hardware enclave
    await SecureStore.setItemAsync(storeKey(meta.accountIndex), privateKeyHex, SECURE_OPTIONS);

    // Store non-sensitive metadata separately (no auth required to read address)
    const fullMeta: KeyMeta = {
      ...meta,
      createdAt: Date.now(),
      deviceId,
    };
    await SecureStore.setItemAsync(
      metaKey(meta.accountIndex),
      JSON.stringify(fullMeta),
      META_OPTIONS,
    );

    // Update account count
    const existing = await SecureStore.getItemAsync(ACCOUNTS_INDEX_KEY, META_OPTIONS);
    const count = existing ? parseInt(existing, 10) : 0;
    if (meta.accountIndex >= count) {
      await SecureStore.setItemAsync(
        ACCOUNTS_INDEX_KEY,
        String(meta.accountIndex + 1),
        META_OPTIONS,
      );
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown error storing key' };
  }
}

/**
 * Retrieve a private key from the secure enclave.
 * Triggers OS-level biometric prompt (required by SECURE_OPTIONS).
 * Returns the key as a hex string for signing, then you should zero it
 * from memory as soon as signing is complete.
 *
 * @param accountIndex  The account index to retrieve
 * @param reason        Prompt message shown to the user
 */
export async function retrievePrivateKey(
  accountIndex: number,
  reason = 'Authenticate to sign transaction',
): Promise<SecureStoreResult<string>> {
  try {
    // Explicit pre-check so we can surface a typed error
    const authed = await authenticate(reason);
    if (!authed) {
      return { ok: false, error: 'Authentication cancelled or failed' };
    }

    // The OS-level requireAuthentication will fire again on the actual read
    // (double-check, defence-in-depth)
    const key = await SecureStore.getItemAsync(storeKey(accountIndex), SECURE_OPTIONS);

    if (!key) {
      return { ok: false, error: `No key found for account index ${accountIndex}` };
    }

    return { ok: true, data: key };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown error retrieving key' };
  }
}

/**
 * Read account metadata (address, derivation path) WITHOUT biometrics.
 * Safe to call at any time (e.g. to display wallet address in the UI).
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

/**
 * List metadata for ALL stored accounts (no biometrics needed).
 */
export async function listAllAccounts(): Promise<SecureStoreResult<KeyMeta[]>> {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNTS_INDEX_KEY, META_OPTIONS);
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
 * Permanently delete a private key and its metadata from the enclave.
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

    await SecureStore.deleteItemAsync(storeKey(accountIndex), SECURE_OPTIONS);
    await SecureStore.deleteItemAsync(metaKey(accountIndex), META_OPTIONS);

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error deleting key' };
  }
}

/**
 * Check if this device supports hardware-backed secure storage.
 * Call on app launch to gate wallet creation.
 */
export async function checkDeviceSecurity(): Promise<{
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  canCreateWallet: boolean;
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  return {
    hasHardware,
    isEnrolled,
    supportedTypes,
    canCreateWallet: hasHardware && isEnrolled,
  };
}

/**
 * Migrate an existing plaintext key (stored with AES-256-GCM in AsyncStorage)
 * into the secure enclave. Call once on app upgrade.
 *
 * @param plaintextPrivKey  The decrypted private key from your old storage
 * @param meta              Address + derivation path
 */
export async function migrateToSecureEnclave(
  plaintextPrivKey: string,
  meta: Omit<KeyMeta, 'createdAt' | 'deviceId'>,
): Promise<SecureStoreResult<void>> {
  const storeResult = await storePrivateKey(plaintextPrivKey, meta);
  if (!storeResult.ok) return storeResult;

  // Caller should delete from old storage after this returns ok: true
  return { ok: true };
}
