/**
 * utils/aa.ts   v2.1.2
 *
 * ERC-4337 Account Abstraction for KryptoNow
 * - LightAccount via permissionless + viem
 * - Pimlico paymaster for gasless transactions
 * - Dynamic imports  Metro stubs on web, never bundled for web build
 *
 * Chains: ETH, Polygon, Arbitrum, Optimism, Base (BSC excluded  no bundler)
 */

import { Platform } from 'react-native'
import { BUNDLER_URLS, PAYMASTER_URLS } from './chains'

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
  gasless?:    boolean
  error?:      string
}

export interface SmartAccountInfo {
  address:    string
  isDeployed: boolean
  chainId:    number
  gasless:    boolean
}

//  Chain support check 

const AA_CHAIN_IDS = [1, 137, 42161, 10, 8453]

export function chainSupportsAA(chainId: number): boolean {
  if (Platform.OS === 'web') return false
  return AA_CHAIN_IDS.includes(chainId)
}

//  Core: build smart account client 

export async function createAAClient(privateKeyHex: string, chainId: number) {
  if (Platform.OS === 'web') throw new Error('AA not supported on web')
  if (!AA_CHAIN_IDS.includes(chainId)) throw new Error(`Chain ${chainId} not supported for AA`)

  const bundlerUrl = BUNDLER_URLS[chainId]
  if (!bundlerUrl) throw new Error(`No bundler URL for chain ${chainId}`)

  // Dynamic imports  stubbed on web by Metro resolver
  const { createPublicClient, createWalletClient, http }    = await import('viem')
  const { privateKeyToAccount }                             = await import('viem/accounts')
  const { mainnet, polygon, arbitrum, optimism, base }      = await import('viem/chains')
  const {
    createSmartAccountClient,
    walletClientToSmartAccountSigner,
    ENTRYPOINT_ADDRESS_V06,
  }                                                         = await import('permissionless')
  const { signerToLightSmartAccount }                       = await import('permissionless/accounts')
  const { createPimlicoPaymasterClient, createPimlicoBundlerClient } = await import('permissionless/clients/pimlico')

  const VIEM_CHAINS: Record<number, any> = {
    1: mainnet, 137: polygon, 42161: arbitrum, 10: optimism, 8453: base,
  }
  const viemChain = VIEM_CHAINS[chainId]

  // Normalise key  ensure 0x prefix
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

  const signer       = walletClientToSmartAccountSigner(walletClient)
  const smartAccount = await signerToLightSmartAccount(publicClient, {
    signer,
    entryPoint:          ENTRYPOINT_ADDRESS_V06,
    lightAccountVersion: '1.1.0',
  })

  //  Paymaster middleware (gasless if Pimlico key available) 
  const pimlicoKey = process.env.EXPO_PUBLIC_PIMLICO_KEY ?? ''
  const pimlicoUrl = PAYMASTER_URLS[chainId] ?? ''
  const gasless    = !!pimlicoKey && !!pimlicoUrl

  let middleware: any

  if (gasless) {
    const paymasterClient = createPimlicoPaymasterClient({
      transport:  http(pimlicoUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V06,
    })
    const bundlerClient = createPimlicoBundlerClient({
      transport:  http(pimlicoUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V06,
    })
    middleware = {
      gasPrice:             async () => bundlerClient.getUserOperationGasPrice(),
      sponsorUserOperation: paymasterClient.sponsorUserOperation,
    }
  } else {
    middleware = {
      gasPrice: async () => publicClient.estimateFeesPerGas(),
    }
  }

  const smartAccountClient = createSmartAccountClient({
    account:          smartAccount,
    chain:            viemChain,
    bundlerTransport: http(gasless ? pimlicoUrl : bundlerUrl),
    middleware,
  })

  return { smartAccountClient, smartAccount, publicClient, gasless }
}

//  Get smart account address 

export async function getSmartAccountAddress(
  privateKeyHex: string,
  chainId: number,
): Promise<SmartAccountInfo> {
  try {
    const { smartAccount, publicClient, gasless } = await createAAClient(privateKeyHex, chainId)
    const address    = smartAccount.address
    const code       = await publicClient.getBytecode({ address: address as `0x${string}` })
    const isDeployed = !!code && code !== '0x'
    return { address, isDeployed, chainId, gasless }
  } catch (e: any) {
    throw new Error(`Failed to get smart account address: ${e.message}`)
  }
}

//  Send single UserOp 

export async function sendUserOp(
  privateKeyHex: string,
  chainId: number,
  to: string,
  value: bigint,
  data: string = '0x',
): Promise<AAResult> {
  try {
    const { smartAccountClient, gasless } = await createAAClient(privateKeyHex, chainId)

    const userOpHash = await smartAccountClient.sendUserOperation({
      userOperation: {
        callData: await smartAccountClient.account.encodeCallData({
          to:   to as `0x${string}`,
          value,
          data: data as `0x${string}`,
        }),
      },
    })

    const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })

    return {
      ok:          true,
      userOpHash,
      txHash:      receipt.receipt.transactionHash,
      gasless,
    }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'UserOp failed' }
  }
}

//  Batch UserOp (atomic multicall) 

export async function sendBatchUserOp(
  privateKeyHex: string,
  chainId: number,
  calls: AACall[],
): Promise<AAResult> {
  try {
    const { smartAccountClient, gasless } = await createAAClient(privateKeyHex, chainId)

    const callData = await smartAccountClient.account.encodeCallData(
      calls.map(c => ({
        to:   c.to as `0x${string}`,
        value: c.value,
        data: c.data as `0x${string}`,
      }))
    )

    const userOpHash = await smartAccountClient.sendUserOperation({
      userOperation: { callData },
    })

    const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })

    return {
      ok:         true,
      userOpHash,
      txHash:     receipt.receipt.transactionHash,
      gasless,
    }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Batch UserOp failed' }
  }
}

//  ERC-20 calldata helper 

export function encodeERC20Transfer(to: string, amount: bigint): string {
  const selector = '0xa9059cbb'
  const paddedTo  = to.toLowerCase().replace('0x', '').padStart(64, '0')
  const paddedAmt = amount.toString(16).padStart(64, '0')
  return selector + paddedTo + paddedAmt
}
