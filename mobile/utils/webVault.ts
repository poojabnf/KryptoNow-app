/**
 * utils/webVault.ts   v2.1.0
 *
 * AES-256-GCM encryption for wallet data stored in localStorage on web.
 * Uses Web Crypto API (SubtleCrypto)  zero external dependencies.
 *
 * Key derivation: PBKDF2(appSecret + deviceSalt, 100_000 iterations, SHA-256)
 * Encryption:     AES-256-GCM with random 12-byte IV per operation
 *
 * Storage layout in localStorage:
 *   kryptonow_vault_salt   random 32-byte hex salt (not secret)
 *   kryptonow_wallet       { ct: base64, iv: base64 } (ciphertext)
 */

// App-level secret from env  injected at build time
// NEVER store this in localStorage or log it
const APP_SECRET = process.env.EXPO_PUBLIC_VAULT_SECRET ?? 'kryptonow-default-dev-secret-change-in-prod'

const SALT_KEY   = 'kryptonow_vault_salt'
const WALLET_KEY = 'kryptonow_wallet'

//  Helpers 

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return arr
}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

//  Key derivation 

async function getOrCreateSalt(): Promise<Uint8Array> {
  const existing = localStorage.getItem(SALT_KEY)
  if (existing) return hexToBuf(existing)

  const salt = crypto.getRandomValues(new Uint8Array(32))
  localStorage.setItem(SALT_KEY, bufToHex(salt.buffer))
  return salt
}

async function deriveKey(salt: Uint8Array, password?: string): Promise<CryptoKey> {
  const enc     = new TextEncoder()
  const secretMaterial = password ? (password + APP_SECRET) : APP_SECRET
  const keyMat  = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretMaterial),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

//  Public API 

export type VaultPayload = {
  address: string
  phrase:  string
  name?:   string
  privateKey?: string
}

/**
 * Encrypt and save wallet data to localStorage.
 * Replaces plain JSON.stringify(wallet) in walletStore.
 */
export async function saveEncryptedWallet(payload: VaultPayload, password?: string): Promise<void> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback for environments without SubtleCrypto (should not happen in browsers)
    localStorage.setItem(WALLET_KEY, JSON.stringify(payload))
    return
  }

  try {
    const salt      = await getOrCreateSalt()
    const key       = await deriveKey(salt, password)
    const iv        = crypto.getRandomValues(new Uint8Array(12))
    const encoded   = new TextEncoder().encode(JSON.stringify(payload))
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

    const stored = {
      ct:  bufToBase64(cipherBuf),
      iv:  bufToBase64(iv.buffer),
      v:   1,  // version  for future migration
    }
    localStorage.setItem(WALLET_KEY, JSON.stringify(stored))
  } catch (e) {
    console.error('[KryptoNow] Vault encrypt failed:', e)
    // Fail safe  store without encryption rather than lose the wallet
    localStorage.setItem(WALLET_KEY, JSON.stringify(payload))
  }
}

/**
 * Load and decrypt wallet data from localStorage.
 * Returns null if no wallet stored.
 * Falls back gracefully if data is legacy plaintext.
 */
export async function loadEncryptedWallet(password?: string): Promise<VaultPayload | null> {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(WALLET_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)

    // Legacy plaintext detection  old format had { address, phrase, name }
    if (parsed.address && !parsed.ct) {
      // Migrate: re-encrypt immediately
      console.log('[KryptoNow] Migrating plaintext wallet to encrypted vault...')
      const payload: VaultPayload = {
        address: parsed.address,
        phrase:  parsed.phrase ?? '',
        name:    parsed.name,
      }
      await saveEncryptedWallet(payload, password)
      return payload
    }

    // Encrypted format
    if (!parsed.ct || !parsed.iv) return null
    if (!window.crypto?.subtle) {
      console.warn('[KryptoNow] SubtleCrypto unavailable  cannot decrypt vault')
      return null
    }

    const salt       = await getOrCreateSalt()
    const key        = await deriveKey(salt, password)
    const iv         = base64ToBuf(parsed.iv)
    const cipherBuf  = base64ToBuf(parsed.ct)
    const plainBuf   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, cipherBuf as BufferSource)
    const plainText  = new TextDecoder().decode(plainBuf)

    return JSON.parse(plainText) as VaultPayload
  } catch (e) {
    console.error('[KryptoNow] Vault decrypt failed:', e)
    return null
  }
}

/**
 * Sync load  returns null always (encrypted vault requires async).
 * Use this for initial walletStore state, then call loadEncryptedWallet()
 * asynchronously in initFromStorage().
 */
export function loadEncryptedWalletSync(): null {
  return null
}

/**
 * Delete the encrypted vault and salt from localStorage.
 * Call on wallet clear / sign out.
 */
export function deleteEncryptedWallet(): void {
  localStorage.removeItem(WALLET_KEY)
  localStorage.removeItem(SALT_KEY)
}
