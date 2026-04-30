/**
 * hooks/usePortfolioHistory.ts
 * Fetches historical portfolio value using CoinGecko price history
 * + Etherscan transaction history to reconstruct balance over time.
 * No extra packages — uses ethers + built-in fetch.
 */

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'

export type TimeRange = '7d' | '30d' | '1y'

export type DataPoint = {
  timestamp:    number   // unix ms
  label:        string   // "Jan 5", "Mon", etc.
  balanceETH:   number
  balanceUSD:   number
  priceETH:     number
}

export type PortfolioStats = {
  currentUSD:     number
  currentETH:     number
  changeUSD:      number
  changePct:      number
  highUSD:        number
  lowUSD:         number
  avgUSD:         number
  isPositive:     boolean
}

const CG_BASE = 'https://api.coingecko.com/api/v3'
const ETHERSCAN_KEY = 'YourEtherscanKey'
const ETH_RPC       = 'https://eth.llamarpc.com'

const DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '1y': 365 }

// CoinGecko market_chart returns [timestamp_ms, price][]
async function fetchPriceHistory(days: number): Promise<[number, number][]> {
  const res  = await fetch(
    `${CG_BASE}/coins/ethereum/market_chart?vs_currency=usd&days=${days}&interval=${days <= 7 ? 'hourly' : 'daily'}`
  )
  const data = await res.json()
  return data.prices ?? []
}

// Get ETH balance at a specific block using Etherscan
async function fetchBalanceAtBlock(address: string, block: number): Promise<number> {
  try {
    const res  = await fetch(
      `https://api.etherscan.io/api?module=account&action=eth_get_balance&address=${address}&tag=0x${block.toString(16)}&apikey=${ETHERSCAN_KEY}`
    )
    const data = await res.json()
    return parseFloat(ethers.formatEther(BigInt(data.result ?? '0')))
  } catch {
    return 0
  }
}

// Get all ETH transfers to reconstruct balance history without querying every block
async function fetchTransactionHistory(address: string): Promise<{
  timeStamp: number; value: string; from: string; to: string; isError: string
}[]> {
  try {
    const res  = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&apikey=${ETHERSCAN_KEY}`
    )
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

// Reconstruct ETH balance at each price history timestamp
// by replaying transactions forward from genesis
function reconstructBalanceHistory(
  priceHistory: [number, number][],
  txHistory: { timeStamp: number; value: string; from: string; to: string; isError: string; gasUsed?: string; gasPrice?: string }[],
  currentBalance: number,
  address: string,
): DataPoint[] {
  // Build cumulative balance deltas per timestamp
  // Start from current balance and work backwards using transactions
  const addrLower = address.toLowerCase()

  // Sort txs ascending
  const sortedTxs = [...txHistory].sort((a, b) => a.timeStamp - b.timeStamp)

  // Forward-replay: track running balance
  // We don't know genesis balance so we calculate from current backwards
  // More robust: use current balance, go backwards through txs
  const now       = Date.now()
  let   runningBalance = currentBalance

  // Map of timestamp → balance just before that moment (going backwards)
  const balanceAtTime: [number, number][] = [[now, currentBalance]]

  for (let i = sortedTxs.length - 1; i >= 0; i--) {
    const tx     = sortedTxs[i]
    if (tx.isError === '1') continue

    const value  = parseFloat(ethers.formatEther(BigInt(tx.value ?? '0')))
    const gasCost = tx.gasUsed && tx.gasPrice
      ? parseFloat(ethers.formatEther(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)))
      : 0

    const ts = tx.timeStamp * 1000

    if (tx.to?.toLowerCase() === addrLower) {
      // Received ETH — going backwards, subtract
      runningBalance -= value
    } else if (tx.from?.toLowerCase() === addrLower) {
      // Sent ETH — going backwards, add back
      runningBalance += value + gasCost
    }
    balanceAtTime.push([ts, Math.max(0, runningBalance)])
  }

  balanceAtTime.reverse()

  // Map price history to data points with interpolated balance
  return priceHistory.map(([ts, price], i) => {
    // Find the most recent balance we know at this timestamp
    let balETH = currentBalance
    for (const [bts, bal] of balanceAtTime) {
      if (bts <= ts) balETH = bal
      else break
    }

    const label = formatLabel(ts, priceHistory.length)
    return {
      timestamp:  ts,
      label,
      balanceETH: balETH,
      balanceUSD: balETH * price,
      priceETH:   price,
    }
  })
}

function formatLabel(ts: number, totalPoints: number): string {
  const d = new Date(ts)
  if (totalPoints <= 24) {
    // Hourly — show time
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  } else if (totalPoints <= 31) {
    // Daily for 30d — show "Jan 5"
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    // Monthly for 1y
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function calculateStats(points: DataPoint[]): PortfolioStats {
  if (points.length === 0) return {
    currentUSD: 0, currentETH: 0, changeUSD: 0, changePct: 0,
    highUSD: 0, lowUSD: 0, avgUSD: 0, isPositive: true,
  }

  const first      = points[0].balanceUSD
  const current    = points[points.length - 1].balanceUSD
  const changeUSD  = current - first
  const changePct  = first > 0 ? (changeUSD / first) * 100 : 0
  const values     = points.map(p => p.balanceUSD)
  const highUSD    = Math.max(...values)
  const lowUSD     = Math.min(...values)
  const avgUSD     = values.reduce((a, b) => a + b, 0) / values.length

  return {
    currentUSD: current,
    currentETH: points[points.length - 1].balanceETH,
    changeUSD,
    changePct,
    highUSD,
    lowUSD,
    avgUSD,
    isPositive: changeUSD >= 0,
  }
}

// ─── The hook ──────────────────────────────────────────────────────────────────
export function usePortfolioHistory(address: string | null) {
  const [data,      setData]      = useState<DataPoint[]>([])
  const [stats,     setStats]     = useState<PortfolioStats | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [range,     setRange]     = useState<TimeRange>('30d')

  const fetch_ = useCallback(async (r: TimeRange) => {
    if (!address) return
    setLoading(true); setError('')

    try {
      const days = DAYS[r]

      // Parallel fetch: price history + current balance + tx history
      const [priceHistory, txHistory] = await Promise.all([
        fetchPriceHistory(days),
        fetchTransactionHistory(address),
      ])

      // Get current ETH balance
      const provider  = new ethers.JsonRpcProvider(ETH_RPC)
      const weiBalance = await provider.getBalance(address)
      const currentETH = parseFloat(ethers.formatEther(weiBalance))

      // Filter price history to requested range
      const cutoff    = Date.now() - days * 24 * 3600 * 1000
      const filtered  = priceHistory.filter(([ts]) => ts >= cutoff)

      // Reconstruct
      const points    = reconstructBalanceHistory(filtered, txHistory, currentETH, address)
      const stats_    = calculateStats(points)

      // Downsample for performance — max 60 points on chart
      const step      = Math.max(1, Math.floor(points.length / 60))
      const sampled   = points.filter((_, i) => i % step === 0 || i === points.length - 1)

      setData(sampled)
      setStats(stats_)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load portfolio history')
    } finally {
      setLoading(false)
    }
  }, [address])

  const setRangeAndFetch = useCallback((r: TimeRange) => {
    setRange(r)
    fetch_(r)
  }, [fetch_])

  const refresh = useCallback(() => fetch_(range), [fetch_, range])

  return { data, stats, loading, error, range, setRange: setRangeAndFetch, refresh }
}
