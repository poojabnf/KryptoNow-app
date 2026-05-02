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
  { id: 1,     name: 'Ethereum',  symbol: 'ETH',   nativeName: 'Ether', icon: 'E',  color: '#627EEA', rpc: 'https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',     explorer: 'https://etherscan.io',            coingeckoId: 'ethereum'      },
  { id: 137,   name: 'Polygon',   symbol: 'MATIC', nativeName: 'Matic', icon: 'P',  color: '#8247E5', rpc: 'https://polygon-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3', explorer: 'https://polygonscan.com',         coingeckoId: 'matic-network' },
  { id: 56,    name: 'BNB Chain', symbol: 'BNB',   nativeName: 'BNB',   icon: 'B',  color: '#F0B90B', rpc: 'https://bsc-dataseed1.binance.org/',                               explorer: 'https://bscscan.com',             coingeckoId: 'binancecoin'   },
  { id: 42161, name: 'Arbitrum',  symbol: 'ETH',   nativeName: 'Ether', icon: 'A',  color: '#2D374B', rpc: 'https://arb-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',     explorer: 'https://arbiscan.io',             coingeckoId: 'ethereum'      },
  { id: 10,    name: 'Optimism',  symbol: 'ETH',   nativeName: 'Ether', icon: 'O',  color: '#FF0420', rpc: 'https://opt-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',     explorer: 'https://optimistic.etherscan.io', coingeckoId: 'ethereum'      },
  { id: 8453,  name: 'Base',      symbol: 'ETH',   nativeName: 'Ether', icon: 'Ba', color: '#0052FF', rpc: 'https://base-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',    explorer: 'https://basescan.org',            coingeckoId: 'ethereum'      },
]

export function getProvider(chain: Chain): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(chain.rpc, chain.id)
}

export function getChainById(id: number): Chain {
  return CHAINS.find(c => c.id === id) ?? CHAINS[0]
}

export function getTxUrl(chain: Chain, hash: string): string {
  return `${chain.explorer}/tx/${hash}`
}