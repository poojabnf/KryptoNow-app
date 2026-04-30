/**
 * useTransactions.ts
 * ------------------
 * Fetches native + ERC-20 transactions for the active wallet/chain
 * from Etherscan-compatible explorer APIs.
 *
 * Supported chains: ETH (mainnet), Polygon, BNB, Arbitrum, Optimism, Base.
 * For chains without an API key, public endpoints are used (rate-limited).
 */
import { useState, useCallback, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType =
  | 'send'
  | 'receive'
  | 'token_send'
  | 'token_receive'
  | 'contract'

export type Tx = {
  hash:      string
  from:      string
  to:        string
  value:     string   // human-readable amount (e.g. "0.042")
  symbol:    string   // "ETH", "USDC", …
  timestamp: number   // Unix seconds
  type:      TxType
  isERC20:   boolean
  gasUsed?:  string
  status:    'success' | 'failed'
}

// ─── Explorer API endpoints ───────────────────────────────────────────────────

const EXPLORER_API: Record<number, string> = {
  1:     'https://api.etherscan.io/api',
  137:   'https://api.polygonscan.com/api',
  56:    'https://api.bscscan.com/api',
  42161: 'https://api.arbiscan.io/api',
  10:    'https://api-optimistic.etherscan.io/api',
  8453:  'https://api.basescan.org/api',
}

// Add your API keys here (or via env vars)
const API_KEYS: Record<number, string> = {
  1:     process.env.EXPO_PUBLIC_ETHERSCAN_KEY   ?? '',
  137:   process.env.EXPO_PUBLIC_POLYGONSCAN_KEY ?? '',
  56:    process.env.EXPO_PUBLIC_BSCSCAN_KEY     ?? '',
  42161: process.env.EXPO_PUBLIC_ARBISCAN_KEY    ?? '',
  10:    process.env.EXPO_PUBLIC_OPTIMISM_KEY    ?? '',
  8453:  process.env.EXPO_PUBLIC_BASESCAN_KEY    ?? '',
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function fromWei(value: string, decimals = 18): string {
  try {
    const n = BigInt(value)
    const d = BigInt(10 ** decimals)
    const whole = n / d
    const frac  = n % d
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6)
    return `${whole}.${fracStr}`
  } catch {
    return '0'
  }
}

function normaliseTx(raw: any, address: string, chainSymbol: string): Tx {
  const isSend = raw.from?.toLowerCase() === address.toLowerCase()

  return {
    hash:      raw.hash,
    from:      raw.from ?? '',
    to:        raw.to   ?? '',
    value:     fromWei(raw.value || '0'),
    symbol:    chainSymbol,
    timestamp: parseInt(raw.timeStamp ?? '0', 10),
    type:      isSend
                 ? (raw.input && raw.input !== '0x' ? 'contract' : 'send')
                 : 'receive',
    isERC20:   false,
    gasUsed:   raw.gasUsed,
    status:    raw.txreceipt_status === '0' ? 'failed' : 'success',
  }
}

function normaliseERC20(raw: any, address: string): Tx {
  const isSend = raw.from?.toLowerCase() === address.toLowerCase()
  const dec    = parseInt(raw.tokenDecimal ?? '18', 10)

  return {
    hash:      raw.hash,
    from:      raw.from ?? '',
    to:        raw.to   ?? '',
    value:     fromWei(raw.value || '0', dec),
    symbol:    raw.tokenSymbol ?? '???',
    timestamp: parseInt(raw.timeStamp ?? '0', 10),
    type:      isSend ? 'token_send' : 'token_receive',
    isERC20:   true,
    status:    'success',
  }
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchTxns(address: string, chainId: number, chainSymbol: string): Promise<Tx[]> {
  const base   = EXPLORER_API[chainId]
  const apikey = API_KEYS[chainId]
  if (!base || !address) return []

  const keyParam = apikey ? `&apikey=${apikey}` : ''
  const limit    = 50

  async function get(action: string): Promise<any[]> {
    const url = `${base}?module=account&action=${action}&address=${address}&sort=desc&offset=${limit}&page=1${keyParam}`
    try {
      const res  = await fetch(url)
      const json = await res.json()
      return Array.isArray(json.result) ? json.result : []
    } catch {
      return []
    }
  }

  const [native, erc20] = await Promise.all([
    get('txlist'),
    get('tokentx'),
  ])

  const normalised: Tx[] = [
    ...native.map(tx => normaliseTx(tx, address, chainSymbol)),
    ...erc20.map(tx => normaliseERC20(tx, address)),
  ]

  // Sort newest first, deduplicate by hash
  const seen = new Set<string>()
  return normalised
    .filter(tx => { if (seen.has(tx.hash)) return false; seen.add(tx.hash); return true })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransactions(address: string | null) {
  const activeChain = useWalletStore(s => s.activeChain)
  const [txns,    setTxns]    = useState<Tx[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const lastFetch = useRef<number>(0)

  const refresh = useCallback(async () => {
    if (!address) return

    // Simple debounce — don't refetch within 10 s
    if (Date.now() - lastFetch.current < 10_000) return
    lastFetch.current = Date.now()

    setLoading(true)
    setError(null)
    try {
      const data = await fetchTxns(address, activeChain.id, activeChain.symbol)
      setTxns(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [address, activeChain.id, activeChain.symbol])

  return { txns, loading, error, refresh }
}


