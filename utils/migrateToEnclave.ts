/**
 * migrateToEnclave.ts
 *
 * One-time migration utility for KryptoNow users upgrading from the old
 * AES-256-GCM + AsyncStorage approach to the hardware Secure Enclave.
 *
 * Call this on app launch (after user authenticates) if migration hasn't run.
 * After a successful migration, delete the old encrypted data from AsyncStorage.
 *
 * Usage:
 *   import { runEnclaveMigration } from './migrateToEnclave';
 *   await runEnclaveMigration();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateToSecureEnclave } from './SecureKeyStore';

// Keys used by the OLD storage system — update these to match your actual keys
const OLD_ENCRYPTED_KEY = 'kn_encrypted_privkey'; // the AES-256-GCM ciphertext
const OLD_ADDRESS_KEY = 'kn_address';
const OLD_DERIV_PATH_KEY = 'kn_deriv_path';
const MIGRATION_DONE_KEY = 'kn_enclave_migrated_v1';

/**
 * Your existing AES-256-GCM decryption function.
 * Replace this stub with your actual implementation.
 */
async function decryptOldKey(
  encryptedHex: string,
  userPin: string,
): Promise<string> {
  // TODO: replace with your real decryption logic
  // e.g. using expo-crypto or react-native-quick-crypto
  //
  // const key = await deriveKeyFromPin(userPin);
  // const plaintext = await aesGcmDecrypt(encryptedHex, key);
  // return plaintext;
  throw new Error('decryptOldKey() not implemented — wire in your AES decrypt here');
}

export async function isMigrationNeeded(): Promise<boolean> {
  const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
  if (done === 'true') return false;

  const oldKey = await AsyncStorage.getItem(OLD_ENCRYPTED_KEY);
  return !!oldKey;
}

/**
 * Run the full migration.
 *
 * @param userPin  The user's existing PIN (used to decrypt the old key).
 *                 NEVER store this — pass it in from a secure in-memory prompt.
 * @returns        { ok: true } on success, { ok: false, error } on failure.
 */
export async function runEnclaveMigration(
  userPin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const needed = await isMigrationNeeded();
    if (!needed) return { ok: true }; // already done or nothing to migrate

    const encryptedKey = await AsyncStorage.getItem(OLD_ENCRYPTED_KEY);
    const address = await AsyncStorage.getItem(OLD_ADDRESS_KEY);
    const derivPath = await AsyncStorage.getItem(OLD_DERIV_PATH_KEY);

    if (!encryptedKey || !address) {
      return { ok: false, error: 'Old key data missing — cannot migrate' };
    }

    // Decrypt the old key (requires user PIN)
    let plainKey: string;
    try {
      plainKey = await decryptOldKey(encryptedKey, userPin);
    } catch {
      return { ok: false, error: 'Failed to decrypt old key — wrong PIN?' };
    }

    // Store in hardware enclave
    const res = await migrateToSecureEnclave(plainKey, {
      accountIndex: 0,
      address,
      derivationPath: derivPath ?? "m/44'/60'/0'/0/0",
    });

    if (!res.ok) return res;

    // ✅ Migration succeeded — delete old data
    await AsyncStorage.multiRemove([
      OLD_ENCRYPTED_KEY,
      OLD_ADDRESS_KEY,
      OLD_DERIV_PATH_KEY,
    ]);
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Migration failed unexpectedly' };
  }
}
