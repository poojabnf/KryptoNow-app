/**
 * utils/tokens.ts
 * ---------------
 * Fetches ERC-20 token balances for a wallet on a given chain.
 * Uses a curated list of top tokens per chain + balanceOf calls.
 */
import { ethers } from 'ethers'
import { Chain, getProvider } from './chains'
import { CHAIN_TOP_TOKENS, toBalanceFormat } from './topTokens'

type TokenMeta = { symbol: string; name: string; address: string; decimals: number; color: string; icon?: string }

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

const CHAIN_TOKENS: Record<number, TokenMeta[]> = Object.fromEntries(
  Object.entries(CHAIN_TOP_TOKENS).map(([id, tokens]) => [id, toBalanceFormat(tokens)])
)

export type FetchedToken = {
  symbol: string; name: string; balance: string
  price: number; change24h: number; valueUSD: number
  color: string; icon?: string
}

export async function fetchChainTokenBalances(
  address: string,
  chain: Chain
): Promise<FetchedToken[]> {
  const tokens = CHAIN_TOKENS[chain.id] ?? []
  if (!tokens.length) return []

  const provider = getProvider(chain)
  const results: FetchedToken[] = []

  // Fetch all balances in parallel
  const balances = await Promise.allSettled(
    tokens.map(async (t) => {
      const contract = new ethers.Contract(t.address, ERC20_ABI, provider)
      const raw: bigint = await contract.balanceOf(address)
      return { token: t, raw }
    })
  )

  // Collect non-zero balances
  const nonZero: { token: TokenMeta; raw: bigint }[] = []
  for (const result of balances) {
    if (result.status === 'fulfilled' && result.value.raw > 0n) {
      nonZero.push(result.value)
    }
  }

  if (!nonZero.length) return []

  // Fetch prices for non-zero tokens from CoinGecko
  const priceMap: Record<string, { usd: number; usd_24h_change: number }> = {}
  try {
    const symbols = nonZero.map(n => n.token.symbol.toLowerCase()).join(',')
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbols}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const data = await res.json()
      Object.assign(priceMap, data)
    }
  } catch {}

  for (const { token, raw } of nonZero) {
    const balance = parseFloat(ethers.formatUnits(raw, token.decimals))
    const priceData = priceMap[token.symbol.toLowerCase()]
    const price = priceData?.usd ?? 0
    const change24h = priceData?.usd_24h_change ?? 0

    results.push({
      symbol:   token.symbol,
      name:     token.name,
      balance:  balance.toFixed(6),
      price,
      change24h,
      valueUSD: balance * price,
      color:    token.color,
      icon:     token.icon,
    })
  }

  return results.sort((a, b) => b.valueUSD - a.valueUSD)
}
