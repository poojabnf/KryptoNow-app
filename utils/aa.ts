/**
 * utils/aa.ts   v2.0.0
 *
 * ERC-4337 Account Abstraction for KryptoNow
 *
 * Architecture:
 *   EOA (existing SecureKeyStore key) acts as the "owner" / signer
 *   LightAccount smart contract is deployed per-user on first use
 *   UserOps are submitted via Alchemy bundler (same API key as RPC)
 *
 * Chains supported: ETH, Polygon, Arbitrum, Optimism, Base
 * BSC excluded  no ERC-4337 bundler on BSC mainnet
 *
 * Dependencies: permissionless, viem (installed)
 * Ethers v6 used only for key retrieval  all AA ops use viem internally
 */

import { createPublicClient, createWalletClient, http, type Chain as ViemChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, polygon, arbitrum, optimism, base } from 'viem/chains'
import {
  createSmartAccountClient,
  walletClientToSmartAccountSigner,
  ENTRYPOINT_ADDRESS_V06,
} from 'permissionless'
import { signerToLightSmartAccount } from 'permissionless/accounts'
import { createPimlicoPaymasterClient, createPimlicoBundlerClient } from 'permissionless/clients/pimlico'
import { BUNDLER_URLS } from './chains'

//  Viem chain map 

const VIEM_CHAINS: Record<number, ViemChain> = {
  1:     mainnet,
  137:   polygon,
  42161: arbitrum,
  10:    optimism,
  8453:  base,
}

//  Types 

export interface AACall {
  to:    string
  value: bigint
  data:  string  // hex calldata, '0x' for native transfer
}

export interface AAResult {
  ok:      boolean
  userOpHash?: string
  txHash?:     string
  error?:      string
}

export interface SmartAccountInfo {
  address:   string
  isDeployed: boolean
  chainId:   number
}

//  Core: build smart account client 

/**
 * Create a LightAccount smart account client for a given EOA private key.
 * The smart account is counterfactually deployed  address is deterministic
 * before deployment, gas is only spent on first transaction.
 *
 * @param privateKeyHex  64-char hex private key from SecureKeyStore (no 0x)
 * @param chainId        Active chain ID
 */
export async function createAAClient(
  privateKeyHex: string,
  chainId: number,
) {
  const viemChain = VIEM_CHAINS[chainId]
  if (!viemChain) throw new Error(`Chain ${chainId} not supported for AA`)

  const bundlerUrl = BUNDLER_URLS[chainId]
  if (!bundlerUrl) throw new Error(`No bundler URL for chain ${chainId}`)

  // Normalise key  ensure 0x prefix for viem
  const pk = (privateKeyHex.startsWith('0x')
    ? privateKeyHex
    : '0x' + privateKeyHex) as `0x${string}`

  const account = privateKeyToAccount(pk)

  const publicClient = createPublicClient({
    chain:     viemChain,
    transport: http(bundlerUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain:     viemChain,
    transport: http(bundlerUrl),
  })

  const signer = walletClientToSmartAccountSigner(walletClient)

  const smartAccount = await signerToLightSmartAccount(publicClient, {
    signer,
    entryPoint:     ENTRYPOINT_ADDRESS_V06,
    lightAccountVersion: '1.1.0',
  })

  const smartAccountClient = createSmartAccountClient({
    account:   smartAccount,
    chain:     viemChain,
    bundlerTransport: http(bundlerUrl),
    middleware: {
      gasPrice: async () => (await publicClient.estimateFeesPerGas()),
    },
  })

  return { smartAccountClient, smartAccount, publicClient }
}

//  Get smart account address (no deployment, no gas) 

/**
 * Get the deterministic smart account address for an EOA.
 * Safe to call at any time  does not deploy or spend gas.
 */
export async function getSmartAccountAddress(
  privateKeyHex: string,
  chainId: number,
): Promise<SmartAccountInfo> {
  try {
    const { smartAccount, publicClient } = await createAAClient(privateKeyHex, chainId)
    const address = smartAccount.address

    // Check if already deployed
    const code = await publicClient.getBytecode({ address: address as `0x${string}` })
    const isDeployed = !!code && code !== '0x'

    return { address, isDeployed, chainId }
  } catch (e: any) {
    throw new Error(`Failed to get smart account address: ${e.message}`)
  }
}

//  Send a single UserOp 

/**
 * Send a single transaction via ERC-4337 UserOp.
 * On first use, deploys the smart account atomically in the same UserOp.
 *
 * @param privateKeyHex  From SecureKeyStore.retrievePrivateKey()
 * @param chainId        Active chain
 * @param to             Recipient address
 * @param value          Wei amount as bigint
 * @param data           Hex calldata ('0x' for native ETH transfer)
 */
export async function sendUserOp(
  privateKeyHex: string,
  chainId: number,
  to: string,
  value: bigint,
  data: string = '0x',
): Promise<AAResult> {
  try {
    const { smartAccountClient } = await createAAClient(privateKeyHex, chainId)

    const userOpHash = await smartAccountClient.sendUserOperation({
      userOperation: {
        callData: await smartAccountClient.account.encodeCallData({
          to:    to as `0x${string}`,
          value,
          data:  data as `0x${string}`,
        }),
      },
    })

    // Wait for inclusion
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    return {
      ok:          true,
      userOpHash,
      txHash:      receipt.receipt.transactionHash,
    }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'UserOp failed' }
  }
}

//  Batch UserOp (atomic multicall) 

/**
 * Execute multiple calls atomically in a single UserOp.
 * All succeed or all revert  no partial state.
 * Replaces sequential sends in batch.tsx.
 *
 * @param privateKeyHex  From SecureKeyStore.retrievePrivateKey()
 * @param chainId        Active chain
 * @param calls          Array of {to, value, data}
 */
export async function sendBatchUserOp(
  privateKeyHex: string,
  chainId: number,
  calls: AACall[],
): Promise<AAResult> {
  try {
    const { smartAccountClient } = await createAAClient(privateKeyHex, chainId)

    const callData = await smartAccountClient.account.encodeCallData(
      calls.map(c => ({
        to:    c.to as `0x${string}`,
        value: c.value,
        data:  c.data as `0x${string}`,
      }))
    )

    const userOpHash = await smartAccountClient.sendUserOperation({
      userOperation: { callData },
    })

    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    return {
      ok:         true,
      userOpHash,
      txHash:     receipt.receipt.transactionHash,
    }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Batch UserOp failed' }
  }
}

//  ERC-20 transfer calldata helper 

/**
 * Encode ERC-20 transfer calldata for use in sendUserOp / sendBatchUserOp.
 *
 * @param to      Recipient address
 * @param amount  Amount in token base units (e.g. parseUnits('1.0', 18))
 */
export function encodeERC20Transfer(to: string, amount: bigint): string {
  // transfer(address,uint256) selector = 0xa9059cbb
  const selector = '0xa9059cbb'
  const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0')
  const paddedAmt = amount.toString(16).padStart(64, '0')
  return selector + paddedTo + paddedAmt
}

//  Check if chain supports AA 

export function chainSupportsAA(chainId: number): boolean {
  return chainId in VIEM_CHAINS
}
