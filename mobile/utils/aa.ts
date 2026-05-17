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
 * Chains: ETH(1), Polygon(137), Arbitrum(42161), Optimism(10), Base(8453)
 * BSC excluded  no ERC-4337 bundler on BSC mainnet
 *
 * Stack: permissionless@0.3.5 + viem@2.x (already installed)
 * All AA libs are dynamic-imported so they are never bundled on web.
 */

import { Platform } from 'react-native'
import { BUNDLER_URLS } from './chains'

//  Types 

export interface AACall {
  to:    string
  value: bigint
  data:  string
}

export interface AAResult {
  ok:          boolean
  userOpHash?: string
  txHash?:     string
  error?:      string
}

export interface SmartAccountInfo {
  address:    string
  isDeployed: boolean
  chainId:    number
  gasless?:   boolean
}

//  Chain support check 

export function chainSupportsAA(chainId: number): boolean {
  if (Platform.OS === 'web') return false
  return [1, 137, 42161, 10, 8453].includes(chainId)
}

//  Internal: load AA libs dynamically (never bundled on web) 

async function loadAALibs() {
  const [
    viem,
    viemChains,
    viemAccounts,
    permissionless,
    permissionlessAccounts,
  ] = await Promise.all([
    import('viem') as Promise<any>,
    import('viem/chains') as Promise<any>,
    import('viem/accounts') as Promise<any>,
    import('permissionless') as Promise<any>,
    import('permissionless/accounts') as Promise<any>,
  ])

  return {
    createPublicClient: viem.createPublicClient,
    createWalletClient: viem.createWalletClient,
    http: viem.http,
    chains: {
      mainnet: viemChains.mainnet,
      polygon: viemChains.polygon,
      arbitrum: viemChains.arbitrum,
      optimism: viemChains.optimism,
      base: viemChains.base,
    } as Record<string, any>,
    privateKeyToAccount: viemAccounts.privateKeyToAccount,
    createSmartAccountClient: permissionless.createSmartAccountClient,
    walletClientToSmartAccountSigner: permissionless.walletClientToSmartAccountSigner,
    ENTRYPOINT_ADDRESS_V06: permissionless.ENTRYPOINT_ADDRESS_V06,
    signerToLightSmartAccount: permissionlessAccounts.signerToLightSmartAccount,
  }
}

const VIEM_CHAIN_IDS: Record<number, string> = {
  1: 'mainnet', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism', 8453: 'base',
}

//  Core: build smart account client 

export async function createAAClient(privateKeyHex: string, chainId: number) {
  if (!chainSupportsAA(chainId)) throw new Error(`Chain ${chainId} not supported for AA`)

  const bundlerUrl = BUNDLER_URLS[chainId]
  if (!bundlerUrl) throw new Error(`No bundler URL for chain ${chainId}`)

  const libs = await loadAALibs()
  const chainName = VIEM_CHAIN_IDS[chainId]
  const viemChain = libs.chains[chainName] ?? libs.chains['mainnet']

  const pk = (privateKeyHex.startsWith('0x')
    ? privateKeyHex
    : '0x' + privateKeyHex) as `0x${string}`

  const account = libs.privateKeyToAccount(pk)

  const publicClient = libs.createPublicClient({
    chain: viemChain,
    transport: libs.http(bundlerUrl),
  })

  const walletClient = libs.createWalletClient({
    account,
    chain: viemChain,
    transport: libs.http(bundlerUrl),
  })

  const signer = libs.walletClientToSmartAccountSigner(walletClient)

  const smartAccount = await libs.signerToLightSmartAccount(publicClient, {
    signer,
    entryPoint:          libs.ENTRYPOINT_ADDRESS_V06,
    lightAccountVersion: '1.1.0',
  })

  const smartAccountClient = libs.createSmartAccountClient({
    account:          smartAccount,
    chain:            viemChain,
    bundlerTransport: libs.http(bundlerUrl),
    middleware: {
      gasPrice: async () => (await publicClient.estimateFeesPerGas()),
    },
  } as any)

  return { smartAccountClient, smartAccount, publicClient }
}

//  Get smart account address 

export async function getSmartAccountAddress(
  privateKeyHex: string,
  chainId: number,
): Promise<SmartAccountInfo> {
  try {
    const { smartAccount, publicClient } = await createAAClient(privateKeyHex, chainId)
    const address = smartAccount.address
    const code = await publicClient.getBytecode({ address: address as `0x${string}` })
    const isDeployed = !!code && code !== '0x'
    return { address, isDeployed, chainId }
  } catch (e: any) {
    throw new Error(`Failed to get smart account address: ${e.message}`)
  }
}

//  Send a single UserOp 

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

    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    return { ok: true, userOpHash, txHash: receipt.receipt.transactionHash }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'UserOp failed' }
  }
}

//  Batch UserOp 

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

    return { ok: true, userOpHash, txHash: receipt.receipt.transactionHash }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Batch UserOp failed' }
  }
}

//  ERC-20 transfer calldata 

export function encodeERC20Transfer(to: string, amount: bigint): string {
  const selector  = '0xa9059cbb'
  const paddedTo  = to.toLowerCase().replace('0x', '').padStart(64, '0')
  const paddedAmt = amount.toString(16).padStart(64, '0')
  return selector + paddedTo + paddedAmt
}
