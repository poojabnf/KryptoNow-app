// Kryptonow  DeFi Yield
// Aave lending + Lido staking
// Rates fetched from public APIs

export interface YieldProduct {
  id: string
  name: string
  protocol: string
  asset: string
  apy: string
  apyValue: number
  type: 'lending' | 'staking' | 'liquidity'
  risk: 'low' | 'medium' | 'high'
  description: string
  color: string
  icon: string
  minAmount: string
  tvl: string
}

export const YIELD_PRODUCTS: YieldProduct[] = [
  {
    id: 'lido-eth',
    name: 'Lido Staked ETH',
    protocol: 'Lido',
    asset: 'ETH',
    apy: '3.8%',
    apyValue: 3.8,
    type: 'staking',
    risk: 'low',
    description: 'Stake ETH and receive stETH. Earn staking rewards without locking funds. Used by 30%+ of all staked ETH.',
    color: '#00A3FF',
    icon: 'L',
    minAmount: '0.01 ETH',
    tvl: '.2B',
  },
  {
    id: 'aave-usdc',
    name: 'Aave USDC Lending',
    protocol: 'Aave',
    asset: 'USDC',
    apy: '5.2%',
    apyValue: 5.2,
    type: 'lending',
    risk: 'low',
    description: 'Lend USDC on Aave and earn interest. Withdraw anytime. Audited by top security firms.',
    color: '#B6509E',
    icon: 'A',
    minAmount: '10 USDC',
    tvl: '.1B',
  },
  {
    id: 'aave-eth',
    name: 'Aave ETH Lending',
    protocol: 'Aave',
    asset: 'ETH',
    apy: '1.9%',
    apyValue: 1.9,
    type: 'lending',
    risk: 'low',
    description: 'Lend ETH on Aave and earn variable interest. No lock-up period.',
    color: '#B6509E',
    icon: 'A',
    minAmount: '0.01 ETH',
    tvl: '.4B',
  },
  {
    id: 'aave-usdt',
    name: 'Aave USDT Lending',
    protocol: 'Aave',
    asset: 'USDT',
    apy: '4.8%',
    apyValue: 4.8,
    type: 'lending',
    risk: 'low',
    description: 'Earn yield on your USDT with Aave lending protocol.',
    color: '#B6509E',
    icon: 'A',
    minAmount: '10 USDT',
    tvl: '.2B',
  },
  {
    id: 'lido-matic',
    name: 'Lido Staked MATIC',
    protocol: 'Lido',
    asset: 'MATIC',
    apy: '5.9%',
    apyValue: 5.9,
    type: 'staking',
    risk: 'low',
    description: 'Stake MATIC with Lido and earn stMATIC rewards.',
    color: '#00A3FF',
    icon: 'L',
    minAmount: '1 MATIC',
    tvl: '',
  },
]

export async function fetchLiveLidoApy(): Promise<number> {
  try {
    const res = await fetch('https://eth-api.lido.fi/v1/protocol/steth/apr/last')
    const data = await res.json()
    return parseFloat((data.data?.apr * 100).toFixed(2)) || 3.8
  } catch {
    return 3.8
  }
}

export function calcEarnings(amount: number, apyValue: number): { daily: string, monthly: string, yearly: string } {
  const daily = (amount * apyValue / 100 / 365)
  const monthly = daily * 30
  const yearly = amount * apyValue / 100
  return {
    daily: daily.toFixed(4),
    monthly: monthly.toFixed(2),
    yearly: yearly.toFixed(2),
  }
}

