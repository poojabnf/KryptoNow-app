/**
 * utils/oneInch.ts
 * 1inch Swap API v6 integration.
 * Docs: https://portal.1inch.dev/documentation/swap/swagger
 *
 * Get your free API key at: https://portal.1inch.dev/
 */

import { CHAIN_TOP_TOKENS, toOneInchFormat } from './topTokens'

export const ONEINCH_API_KEY = process.env.EXPO_PUBLIC_ONEINCH_KEY ?? ''  // set EXPO_PUBLIC_ONEINCH_KEY in EAS secrets

const BASE = 'https://api.1inch.dev/swap/v6.0'

const HEADERS = {
  'Authorization': `Bearer ${ONEINCH_API_KEY}`,
  'Accept':        'application/json',
}

// ─── Revenue: Swap fee collection ─────────────────────────────────────────────
// KryptoNow earns 0.1% on every swap via 1inch referral program.
// Register at https://portal.1inch.dev/ to activate fee sharing.
// Pro subscribers pay 0% — use hasFee=false when calling getQuote/getSwapData.
export const SWAP_FEE_PERCENT  = 0.1   // 0.1% — shown to users in UI
export const FEE_RECIPIENT     = process.env.EXPO_PUBLIC_FEE_WALLET ?? ''  // set EXPO_PUBLIC_FEE_WALLET in EAS secrets

// ─── Types ────────────────────────────────────────────────────────────────────

export type OneInchToken = {
  address:  string
  symbol:   string
  name:     string
  decimals: number
  logoURI:  string
}

export type QuoteResult = {
  fromToken:    OneInchToken
  toToken:      OneInchToken
  fromAmount:   string        // in wei
  toAmount:     string        // in wei
  toAmountHuman:string        // human-readable with decimals
  priceImpact:  number        // percent, e.g. 0.12
  gas:          number        // estimated gas units
}

export type SwapTxData = {
  from:     string
  to:       string            // 1inch router contract address
  data:     string            // encoded swap calldata
  value:    string            // native token value in wei (for ETH swaps)
  gas:      number
  gasPrice: string
}

// ─── Token list ───────────────────────────────────────────────────────────────

// Top tokens per chain — used as default suggestions in the picker
export const TOP_TOKENS: Record<number, OneInchToken[]> = Object.fromEntries(
  Object.entries(CHAIN_TOP_TOKENS).map(([id, tokens]) => [id, toOneInchFormat(tokens)])
)

const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// ─── Quote ────────────────────────────────────────────────────────────────────

export async function getQuote(
  chainId:    number,
  fromToken:  OneInchToken,
  toToken:    OneInchToken,
  fromAmount: string,         // in wei
  hasFee = true,              // false for Pro subscribers
): Promise<QuoteResult> {
  const params = new URLSearchParams({
    src:             fromToken.address,
    dst:             toToken.address,
    amount:          fromAmount,
    includeGas:      'true',
    includeProtocols:'false',
  })
  if (hasFee) {
    params.set('fee',      SWAP_FEE_PERCENT.toString())
    params.set('referrer', FEE_RECIPIENT)
  }

  const res = await fetch(`${BASE}/${chainId}/quote?${params}`, { headers: HEADERS })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.description ?? `Quote failed: ${res.status}`)
  }
  const data = await res.json()

  const toAmountBig  = BigInt(data.dstAmount ?? data.toAmount ?? '0')
  const toAmountHuman = (Number(toAmountBig) / Math.pow(10, toToken.decimals)).toFixed(6)

  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount:     data.dstAmount ?? data.toAmount ?? '0',
    toAmountHuman,
    priceImpact:  parseFloat(data.estimatedPriceImpact ?? '0'),
    gas:          data.gas ?? 200000,
  }
}

// ─── Swap calldata ────────────────────────────────────────────────────────────

export async function getSwapData(
  chainId:    number,
  fromToken:  OneInchToken,
  toToken:    OneInchToken,
  fromAmount: string,          // in wei
  fromAddress:string,          // wallet address
  slippage:   number,          // percent, e.g. 1 for 1%
  hasFee = true,               // false for Pro subscribers
): Promise<SwapTxData> {
  const params = new URLSearchParams({
    src:         fromToken.address,
    dst:         toToken.address,
    amount:      fromAmount,
    from:        fromAddress,
    slippage:    slippage.toString(),
    disableEstimate: 'false',
    allowPartialFill:'false',
  })
  if (hasFee) {
    params.set('fee',      SWAP_FEE_PERCENT.toString())
    params.set('referrer', FEE_RECIPIENT)
  }

  const res = await fetch(`${BASE}/${chainId}/swap?${params}`, { headers: HEADERS })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.description ?? `Swap data failed: ${res.status}`)
  }
  const data = await res.json()

  return {
    from:     data.tx.from,
    to:       data.tx.to,
    data:     data.tx.data,
    value:    data.tx.value ?? '0',
    gas:      data.tx.gas ?? 200000,
    gasPrice: data.tx.gasPrice,
  }
}

// ─── Allowance ────────────────────────────────────────────────────────────────

/** Check current ERC-20 allowance for the 1inch router */
export async function getAllowance(
  chainId:  number,
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> {
  if (tokenAddress.toLowerCase() === NATIVE_ADDRESS.toLowerCase()) return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

  const params = new URLSearchParams({ tokenAddress, walletAddress })
  const res    = await fetch(`${BASE}/${chainId}/approve/allowance?${params}`, { headers: HEADERS })
  if (!res.ok) return 0n
  const data   = await res.json()
  return BigInt(data.allowance ?? '0')
}

/** Get approval calldata for a token */
export async function getApproveData(
  chainId:      number,
  tokenAddress: string,
  amount?:      string,         // omit for infinite approval
): Promise<{ to: string; data: string; value: string }> {
  const params = new URLSearchParams({ tokenAddress })
  if (amount) params.set('amount', amount)

  const res  = await fetch(`${BASE}/${chainId}/approve/transaction?${params}`, { headers: HEADERS })
  if (!res.ok) throw new Error('Failed to get approval data')
  const data = await res.json()
  return { to: data.to, data: data.data, value: data.value ?? '0' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === NATIVE_ADDRESS.toLowerCase()
}

export function toWei(amount: string, decimals: number): string {
  try {
    const [int, dec = ''] = amount.split('.')
    const padded  = (dec + '0'.repeat(decimals)).slice(0, decimals)
    const full    = (BigInt(int || '0') * BigInt(10 ** decimals) + BigInt(padded || '0')).toString()
    return full
  } catch {
    return '0'
  }
}
