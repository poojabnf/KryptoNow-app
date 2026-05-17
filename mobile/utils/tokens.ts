/**
 * utils/tokens.ts
 * ---------------
 * Fetches ERC-20 token balances for a wallet on a given chain.
 * Uses a curated list of top tokens per chain + balanceOf calls.
 */
import { ethers } from 'ethers'
import { Chain, getProvider } from './chains'

type TokenMeta = { symbol: string; name: string; address: string; decimals: number; color: string; icon?: string }

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// Top tokens per chain
const CHAIN_TOKENS: Record<number, TokenMeta[]> = {
  // Ethereum
  1: [
    { symbol: 'USDT',  name: 'Tether USD',       address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  color: '#26A17B' },
    { symbol: 'USDC',  name: 'USD Coin',          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  color: '#2775CA' },
    { symbol: 'WBTC',  name: 'Wrapped Bitcoin',   address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  color: '#F7931A' },
    { symbol: 'DAI',   name: 'Dai Stablecoin',    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, color: '#F5AC37' },
    { symbol: 'LINK',  name: 'Chainlink',          address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, color: '#375BD2' },
    { symbol: 'UNI',   name: 'Uniswap',            address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, color: '#FF007A' },
  ],
  // Polygon
  137: [
    { symbol: 'USDT',  name: 'Tether USD',        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6,  color: '#26A17B' },
    { symbol: 'USDC',  name: 'USD Coin',           address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6,  color: '#2775CA' },
    { symbol: 'WETH',  name: 'Wrapped Ether',      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, color: '#627EEA' },
    { symbol: 'DAI',   name: 'Dai Stablecoin',     address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, color: '#F5AC37' },
  ],
  // BNB Chain
  56: [
    { symbol: 'USDT',  name: 'Tether USD',         address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, color: '#26A17B' },
    { symbol: 'USDC',  name: 'USD Coin',            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, color: '#2775CA' },
    { symbol: 'BUSD',  name: 'Binance USD',         address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, color: '#F0B90B' },
  ],
  // Arbitrum
  42161: [
    { symbol: 'USDC',  name: 'USD Coin',            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6,  color: '#2775CA' },
    { symbol: 'USDT',  name: 'Tether USD',          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6,  color: '#26A17B' },
    { symbol: 'WBTC',  name: 'Wrapped Bitcoin',     address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8,  color: '#F7931A' },
  ],
  // Optimism
  10: [
    { symbol: 'USDC',  name: 'USD Coin',            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6,  color: '#2775CA' },
    { symbol: 'USDT',  name: 'Tether USD',          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6,  color: '#26A17B' },
    { symbol: 'DAI',   name: 'Dai Stablecoin',      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, color: '#F5AC37' },
  ],
  // Base
  8453: [
    { symbol: 'USDC',  name: 'USD Coin',            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  color: '#2775CA' },
    { symbol: 'DAI',   name: 'Dai Stablecoin',      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, color: '#F5AC37' },
  ],
}

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
