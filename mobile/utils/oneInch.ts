/**
 * utils/oneInch.ts
 * 1inch Swap API v6 integration.
 * Docs: https://portal.1inch.dev/documentation/swap/swagger
 *
 * Get your free API key at: https://portal.1inch.dev/
 */

export const ONEINCH_API_KEY = process.env.EXPO_PUBLIC_1INCH_API_KEY ?? ''

const BASE = 'https://api.1inch.dev/swap/v6.0'

const HEADERS = {
  'Authorization': `Bearer ${ONEINCH_API_KEY}`,
  'Accept':        'application/json',
}

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
export const TOP_TOKENS: Record<number, OneInchToken[]> = {
  1: [  // Ethereum
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH',  name: 'Ethereum',    decimals: 18, logoURI: '' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin',    decimals: 6,  logoURI: '' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether',      decimals: 6,  logoURI: '' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI',  name: 'Dai',         decimals: 18, logoURI: '' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8,  logoURI: '' },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI',  name: 'Uniswap',     decimals: 18, logoURI: '' },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave',        decimals: 18, logoURI: '' },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink',   decimals: 18, logoURI: '' },
  ],
  137: [ // Polygon
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'POL',  name: 'POL',      decimals: 18, logoURI: '' },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin',  decimals: 6,  logoURI: '' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether',    decimals: 6,  logoURI: '' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI',  name: 'Dai',       decimals: 18, logoURI: '' },
  ],
  42161: [ // Arbitrum
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH',  name: 'Ethereum', decimals: 18, logoURI: '' },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6,  logoURI: '' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether',   decimals: 6,  logoURI: '' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI',  name: 'Dai',      decimals: 18, logoURI: '' },
  ],
  10: [ // Optimism
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH',  name: 'Ethereum', decimals: 18, logoURI: '' },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6,  logoURI: '' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether',   decimals: 6,  logoURI: '' },
  ],
  56: [ // BNB
    { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'BNB',  name: 'BNB',      decimals: 18, logoURI: '' },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether',   decimals: 18, logoURI: '' },
    { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', name: 'BUSD',     decimals: 18, logoURI: '' },
  ],
}

const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// ─── Quote ────────────────────────────────────────────────────────────────────

export async function getQuote(
  chainId:    number,
  fromToken:  OneInchToken,
  toToken:    OneInchToken,
  fromAmount: string,         // in wei
): Promise<QuoteResult> {
  const params = new URLSearchParams({
    src:             fromToken.address,
    dst:             toToken.address,
    amount:          fromAmount,
    includeGas:      'true',
    includeProtocols:'false',
  })

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
