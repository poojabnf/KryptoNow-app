/**
 * utils/crypto.ts
 * ---------------
 * ✅ Bug 5 fix: import.tsx depends on validateMnemonic + deriveWallet
 * from this file — which was missing, crashing the import screen on load.
 *
 * Uses ethers.js v6 BIP-39 / HD wallet derivation.
 * react-native-get-random-values must be imported before ethers
 * in the root _layout.tsx (already done).
 */
import { ethers } from 'ethers'

/**
 * Validate a BIP-39 mnemonic phrase (12 or 24 words with valid checksum).
 * Returns true only if the phrase passes ethers.js BIP-39 checksum validation.
 */
export function validateMnemonic(phrase: string): boolean {
  try {
    const trimmed = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
    const words   = trimmed.split(' ')
    if (words.length !== 12 && words.length !== 24) return false
    // ethers v6: Mnemonic.isValidMnemonic
    return ethers.Mnemonic.isValidMnemonic(trimmed)
  } catch {
    return false
  }
}

/**
 * Derive an ethers Wallet from a BIP-39 mnemonic phrase.
 * Returns a wallet with .address and .privateKey populated.
 * Throws if the phrase is invalid.
 */
export function deriveWallet(phrase: string): ethers.HDNodeWallet {
  const trimmed = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!validateMnemonic(trimmed)) {
    throw new Error('Invalid mnemonic phrase')
  }
  return ethers.Wallet.fromPhrase(trimmed)
}

/**
 * Shorten an Ethereum address for display: 0x1234...abcd
 */
export function shortAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Convert wei (bigint) to ETH string, formatted to given decimal places.
 */
export function weiToEth(wei: bigint, decimals = 6): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(decimals)
}
