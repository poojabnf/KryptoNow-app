/**
 * utils/crypto.ts
 * BIP-39 mnemonic generation + BIP-44 HD key derivation using ethers v6
 * This module never touches storage — it only does pure key math.
 */

import { ethers } from 'ethers'

// Standard Ethereum BIP-44 derivation path (account 0, index 0)
const ETH_PATH = "m/44'/60'/0'/0/0"

export type DerivedWallet = {
  address:    string
  privateKey: string
  publicKey:  string
  path:       string
}

// ─── Mnemonic generation ──────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 12-word BIP-39 mnemonic.
 * 16 bytes entropy = 12 words. Never use Math.random() for this.
 */
export function generateMnemonic(): string {
  const entropy = ethers.randomBytes(16) // 128 bits → 12 words
  return ethers.Mnemonic.entropyToPhrase(entropy)
}

/**
 * Validate a 12 or 24 word BIP-39 mnemonic phrase.
 * Checks both word count and checksum.
 */
export function validateMnemonic(phrase: string): boolean {
  try {
    const trimmed = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
    const wordCount = trimmed.split(' ').length
    if (wordCount !== 12 && wordCount !== 24) return false
    return ethers.Mnemonic.isValidMnemonic(trimmed)
  } catch {
    return false
  }
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derive an Ethereum wallet from a BIP-39 mnemonic using BIP-44 path.
 * Returns address, privateKey, and publicKey.
 * NEVER log or store the returned privateKey in insecure storage.
 */
export function deriveWallet(mnemonic: string): DerivedWallet {
  const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!ethers.Mnemonic.isValidMnemonic(trimmed)) {
    throw new Error('Invalid mnemonic phrase')
  }

  const hdNode = ethers.HDNodeWallet.fromPhrase(trimmed, undefined, ETH_PATH)

  return {
    address:    hdNode.address,
    privateKey: hdNode.privateKey,
    publicKey:  hdNode.publicKey,
    path:       ETH_PATH,
  }
}

// ─── Address utilities ────────────────────────────────────────────────────────

/**
 * Validate an Ethereum address (with checksum support).
 */
export function isValidAddress(addr: string): boolean {
  try {
    ethers.getAddress(addr) // throws if invalid
    return true
  } catch {
    return false
  }
}

/**
 * Return EIP-55 checksummed address.
 */
export function checksumAddress(addr: string): string {
  try {
    return ethers.getAddress(addr)
  } catch {
    return addr
  }
}
