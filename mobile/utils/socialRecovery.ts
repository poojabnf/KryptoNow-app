/**
 * utils/socialRecovery.ts  v1.0.0
 * --------------------------------
 * Social Recovery for KryptoNow LightAccount (ERC-4337)
 *
 * Architecture:
 *   - Guardians are stored locally (signed commitments) + optionally on-chain
 *   - Recovery = guardian signs a "recoverTo" message  threshold met  new owner set
 *   - Uses LightAccount.transferOwnership() as the final step
 *   - Guardian commitments are EIP-712 signed typed data
 *   - No new contracts needed for basic guardian management
 *
 * Flow:
 *   Owner adds guardians (ETH addresses)  stored in SecureStorage
 *   If wallet lost: guardian signs recovery request  owner calls transferOwnership
 *   With 2-of-3: collect 2 sigs  build UserOp  execute transferOwnership
 */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'kryptonow_guardians'

export interface Guardian {
  id:        string
  address:   string
  nickname:  string
  addedAt:   number
  confirmed: boolean  // true if guardian has verified they control the address
}

export interface RecoveryConfig {
  guardians:         Guardian[]
  threshold:         number   // min sigs needed (e.g. 2 of 3)
  smartAccountAddr:  string
  chainId:           number
  createdAt:         number
}

export interface RecoveryRequest {
  id:               string
  smartAccountAddr: string
  newOwnerAddr:     string
  chainId:          number
  deadline:         number   // unix timestamp
  signatures:       { guardianAddr: string; sig: string }[]
  status:           'pending' | 'ready' | 'executed' | 'expired'
  createdAt:        number
}

//  EIP-712 typed data for recovery signature 

export const RECOVERY_DOMAIN = (chainId: number, smartAccountAddr: string) => ({
  name:              'KryptoNow Social Recovery',
  version:           '1',
  chainId,
  verifyingContract: smartAccountAddr as `0x${string}`,
})

export const RECOVERY_TYPES = {
  RecoverAccount: [
    { name: 'smartAccount', type: 'address' },
    { name: 'newOwner',     type: 'address' },
    { name: 'deadline',     type: 'uint256' },
    { name: 'nonce',        type: 'uint256' },
  ],
}

//  Storage helpers 

export async function loadRecoveryConfig(smartAccountAddr: string): Promise<RecoveryConfig | null> {
  try {
    const key = `${STORAGE_KEY}_${smartAccountAddr.toLowerCase()}`
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(key)
      : await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function saveRecoveryConfig(config: RecoveryConfig): Promise<void> {
  try {
    const key = `${STORAGE_KEY}_${config.smartAccountAddr.toLowerCase()}`
    const val = JSON.stringify(config)
    if (Platform.OS === 'web') localStorage.setItem(key, val)
    else await AsyncStorage.setItem(key, val)
  } catch {}
}

export async function loadRecoveryRequests(smartAccountAddr: string): Promise<RecoveryRequest[]> {
  try {
    const key = `${STORAGE_KEY}_requests_${smartAccountAddr.toLowerCase()}`
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(key)
      : await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export async function saveRecoveryRequest(
  smartAccountAddr: string,
  req: RecoveryRequest,
): Promise<void> {
  try {
    const existing = await loadRecoveryRequests(smartAccountAddr)
    const updated  = [req, ...existing.filter(r => r.id !== req.id)].slice(0, 10)
    const key = `${STORAGE_KEY}_requests_${smartAccountAddr.toLowerCase()}`
    const val = JSON.stringify(updated)
    if (Platform.OS === 'web') localStorage.setItem(key, val)
    else await AsyncStorage.setItem(key, val)
  } catch {}
}

//  Guardian management 

export function createGuardian(address: string, nickname: string): Guardian {
  return {
    id:        `guardian-${Date.now()}`,
    address:   address.toLowerCase(),
    nickname:  nickname.trim(),
    addedAt:   Date.now(),
    confirmed: false,
  }
}

export function validateGuardianSetup(guardians: Guardian[], threshold: number): string | null {
  if (guardians.length < 1)          return 'Add at least 1 guardian'
  if (guardians.length > 5)          return 'Maximum 5 guardians allowed'
  if (threshold < 1)                 return 'Threshold must be at least 1'
  if (threshold > guardians.length)  return `Threshold cannot exceed ${guardians.length} guardians`
  return null
}

//  Recovery signature 

export async function signRecoveryRequest(
  privateKeyHex: string,
  smartAccountAddr: string,
  newOwnerAddr: string,
  chainId: number,
  deadline: number,
  nonce = 0,
): Promise<string> {
  const { createWalletClient, http } = await import('viem')
  const { privateKeyToAccount }      = await import('viem/accounts')
  const { mainnet, polygon, arbitrum, optimism, base } = await import('viem/chains')

  const CHAINS: Record<number, any> = {
    1: mainnet, 137: polygon, 42161: arbitrum, 10: optimism, 8453: base,
  }

  const pk = (privateKeyHex.startsWith('0x')
    ? privateKeyHex
    : '0x' + privateKeyHex) as `0x${string}`

  const account = privateKeyToAccount(pk)
  const client  = createWalletClient({
    account,
    chain:     CHAINS[chainId] ?? mainnet,
    transport: http(),
  })

  const sig = await client.signTypedData({
    domain:      RECOVERY_DOMAIN(chainId, smartAccountAddr),
    types:       RECOVERY_TYPES,
    primaryType: 'RecoverAccount',
    message: {
      smartAccount: smartAccountAddr as `0x${string}`,
      newOwner:     newOwnerAddr     as `0x${string}`,
      deadline:     BigInt(deadline),
      nonce:        BigInt(nonce),
    },
  })

  return sig
}

//  Execute recovery via LightAccount.transferOwnership 

export async function executeRecovery(
  guardianPrivateKey: string,   // guardian's key  they initiate the tx
  smartAccountAddr:   string,
  newOwnerAddr:       string,
  chainId:            number,
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    // Build transferOwnership calldata
    // LightAccount.transferOwnership(address newOwner)
    // selector: 0xf2fde38b
    const selector   = '0xf2fde38b'
    const paddedAddr = newOwnerAddr.toLowerCase().replace('0x', '').padStart(64, '0')
    const calldata   = (selector + paddedAddr) as `0x${string}`

    // Send as UserOp from guardian's smart account targeting the victim's smart account
    // In practice: the guardian calls transferOwnership on the victim's LightAccount
    // This requires the victim's LightAccount to have pre-authorized the guardian
    // We use a direct eth_sendTransaction from the guardian's EOA for simplicity
    const { createWalletClient, createPublicClient, http } = await import('viem')
    const { privateKeyToAccount }      = await import('viem/accounts')
    const { mainnet, polygon, arbitrum, optimism, base } = await import('viem/chains')

    const CHAINS: Record<number, any> = {
      1: mainnet, 137: polygon, 42161: arbitrum, 10: optimism, 8453: base,
    }

    const { BUNDLER_URLS } = await import('./chains')
    const rpcUrl = BUNDLER_URLS[chainId]

    const pk = (guardianPrivateKey.startsWith('0x')
      ? guardianPrivateKey
      : '0x' + guardianPrivateKey) as `0x${string}`

    const account = privateKeyToAccount(pk)
    const client  = createWalletClient({
      account,
      chain:     CHAINS[chainId],
      transport: http(rpcUrl),
    })
    const publicClient = createPublicClient({
      chain:     CHAINS[chainId],
      transport: http(rpcUrl),
    })

    const hash = await client.sendTransaction({
      to:   smartAccountAddr as `0x${string}`,
      data: calldata,
    })

    await publicClient.waitForTransactionReceipt({ hash })

    return { ok: true, txHash: hash }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Recovery failed' }
  }
}

//  Verify guardian signature 

export async function verifyGuardianSig(
  sig:              string,
  smartAccountAddr: string,
  newOwnerAddr:     string,
  chainId:          number,
  deadline:         number,
  nonce:            number,
  expectedSigner:   string,
): Promise<boolean> {
  try {
    const { verifyTypedData } = await import('viem')
    const valid = await verifyTypedData({
      address:     expectedSigner as `0x${string}`,
      domain:      RECOVERY_DOMAIN(chainId, smartAccountAddr),
      types:       RECOVERY_TYPES,
      primaryType: 'RecoverAccount',
      message: {
        smartAccount: smartAccountAddr as `0x${string}`,
        newOwner:     newOwnerAddr     as `0x${string}`,
        deadline:     BigInt(deadline),
        nonce:        BigInt(nonce),
      },
      signature: sig as `0x${string}`,
    })
    return valid
  } catch { return false }
}
