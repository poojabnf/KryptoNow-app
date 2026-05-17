export const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? 'Gw7PHs6VFH8gDXU4joBdN';

export const RPC = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  polygon:  `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  optimism: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  bnb:      'https://bsc-dataseed1.binance.org/',
};

export const CHAIN_CONFIG = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH',  rpc: RPC.ethereum, decimals: 18 },
  { id: 'polygon',  name: 'Polygon',  symbol: 'POL',  rpc: RPC.polygon,  decimals: 18 },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH',  rpc: RPC.arbitrum, decimals: 18 },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH',  rpc: RPC.optimism, decimals: 18 },
  { id: 'bnb',      name: 'BNB Chain',symbol: 'BNB',  rpc: RPC.bnb,      decimals: 18 },
];

// updated: 2026-05-01 16:03:01

// rebuild: 2026-05-02 01:24:13

// rebuild: 2026-05-02 01:25:01

// rebuild: 2026-05-02 01:25:53
