export interface Token {
  id: string
  symbol: string
  name: string
  icon: string
  color: string
  decimals: number
  contractAddress?: string
}

export const SUPPORTED_TOKENS: Token[] = [
  { id:'ethereum',      symbol:'ETH',   name:'Ethereum', icon:'E',  color:'#6366F1', decimals:18 },
  { id:'bitcoin',       symbol:'BTC',   name:'Bitcoin',  icon:'B',  color:'#F59E0B', decimals:8  },
  { id:'tether',        symbol:'USDT',  name:'Tether',   icon:'T',  color:'#10B981', decimals:6  },
  { id:'usd-coin',      symbol:'USDC',  name:'USD Coin', icon:'U',  color:'#2563EB', decimals:6  },
  { id:'solana',        symbol:'SOL',   name:'Solana',   icon:'S',  color:'#8B5CF6', decimals:9  },
  { id:'binancecoin',   symbol:'BNB',   name:'BNB',      icon:'N',  color:'#D97706', decimals:18 },
  { id:'matic-network', symbol:'MATIC', name:'Polygon',  icon:'M',  color:'#7C3AED', decimals:18 },
  { id:'chainlink',     symbol:'LINK',  name:'Chainlink',icon:'L',  color:'#2563EB', decimals:18 },
]

export interface TokenPrice {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
}

export async function fetchAllPrices(): Promise<TokenPrice[]> {
  const ids = SUPPORTED_TOKENS.map(t => t.id).join(',')
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids + '&order=market_cap_desc&sparkline=false&price_change_percentage=24h'
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  const data = await res.json()
  return data.map((coin: any) => ({
    id: coin.id,
    symbol: (coin.symbol || '').toUpperCase(),
    name: coin.name || '',
    price: coin.current_price || 0,
    change24h: coin.price_change_percentage_24h ?? 0,
    marketCap: coin.market_cap || 0,
    volume24h: coin.total_volume || 0,
  }))
}

export function toUSD(amount: number): string {
  if (!amount || amount < 0.01) return '.00'
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 }).format(amount)
}

export function toUSDCompact(amount: number): string {
  if (!amount) return ''
  if (amount >= 1e9) return '$' + (amount/1e9).toFixed(2) + 'B'
  if (amount >= 1e6) return '$' + (amount/1e6).toFixed(2) + 'M'
  if (amount >= 1e3) return '$' + (amount/1e3).toFixed(2) + 'K'
  return toUSD(amount)
}

export function formatChange(change: number | null | undefined): string {
  const val = change ?? 0
  const sign = val >= 0 ? '+' : ''
  return sign + val.toFixed(2) + '%'
}
