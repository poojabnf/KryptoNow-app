import { ethers } from 'ethers'

export type Chain = {
  id:          number
  name:        string
  symbol:      string
  nativeName:  string
  icon:        string
  color:       string
  rpc:         string
  explorer:    string
  coingeckoId: string
}

export const CHAINS: Chain[] = [
  { id: 1,     name: 'Ethereum',  symbol: 'ETH',  nativeName: 'Ether',          icon: 'Ξ',  color: '#627EEA', rpc: 'https://rpc.ankr.com/eth',            explorer: 'https://etherscan.io',             coingeckoId: 'ethereum'     },
  { id: 137,   name: 'Polygon',   symbol: 'MATIC', nativeName: 'Matic',          icon: '⬡',  color: '#8247E5', rpc: 'https://rpc.ankr.com/polygon',              explorer: 'https://polygonscan.com',          coingeckoId: 'matic-network'},
  { id: 56,    name: 'BNB Chain', symbol: 'BNB',  nativeName: 'BNB',            icon: '◈',  color: '#F0B90B', rpc: 'https://rpc.ankr.com/bsc',      explorer: 'https://bscscan.com',              coingeckoId: 'binancecoin'  },
  { id: 42161, name: 'Arbitrum',  symbol: 'ETH',  nativeName: 'Ether',          icon: '🔵', color: '#2D374B', rpc: 'https://rpc.ankr.com/arbitrum',          explorer: 'https://arbiscan.io',              coingeckoId: 'ethereum'     },
  { id: 10,    name: 'Optimism',  symbol: 'ETH',  nativeName: 'Ether',          icon: '🔴', color: '#FF0420', rpc: 'https://rpc.ankr.com/optimism',           explorer: 'https://optimistic.etherscan.io',  coingeckoId: 'ethereum'     },
  { id: 8453,  name: 'Base',      symbol: 'ETH',  nativeName: 'Ether',          icon: '🔷', color: '#0052FF', rpc: 'https://rpc.ankr.com/base',              explorer: 'https://basescan.org',             coingeckoId: 'ethereum'     },
]

export function getProvider(chain: Chain): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(chain.rpc, chain.id)
}

export function getChainById(id: number): Chain {
  return CHAINS.find(c => c.id === id) ?? CHAINS[0]
}
