import { CHAIN_CONFIG } from './rpc';

export interface ChainBalance {
  chainId:  string;
  name:     string;
  symbol:   string;
  balance:  string;
  usdValue: number;
  error?:   string;
}

// Fetch with 5s timeout so one dead chain never hangs everything
async function fetchWithTimeout(url: string, options: RequestInit, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNativeBalance(rpc: string, address: string): Promise<string> {
  console.log("[Balance] Fetching from RPC:", rpc.substring(0, 50));
  const res = await fetchWithTimeout(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  });
  const data = await res.json();
  console.log("[Balance] RPC response:", JSON.stringify(data).substring(0, 100));
  if (!data.result) return '0.000000';
  const wei = parseInt(data.result, 16);
  return (wei / 1e18).toFixed(6);
}

// Fetch all 5 chain balances in parallel  failed chains show 0 with error flag
export async function fetchAllChainBalances(address: string): Promise<ChainBalance[]> {
  const results = await Promise.allSettled(
    CHAIN_CONFIG.map(async (chain) => {
      const balance = await fetchNativeBalance(chain.rpc, address);
      return {
        chainId:  chain.id,
        name:     chain.name,
        symbol:   chain.symbol,
        balance,
        usdValue: 0,
      } as ChainBalance;
    })
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      chainId:  CHAIN_CONFIG[i].id,
      name:     CHAIN_CONFIG[i].name,
      symbol:   CHAIN_CONFIG[i].symbol,
      balance:  '0.000000',
      usdValue: 0,
      error:    'Failed to fetch',
    };
  });
}

export interface TokenBalance {
  symbol:          string;
  name:            string;
  balance:         string;
  decimals:        number;
  usdValue:        number;
  contractAddress: string;
}

export interface Transaction {
  hash:      string;
  from:      string;
  to:        string;
  value:     string;
  asset:     string;
  type:      'sent' | 'received';
  timestamp: string;
}
