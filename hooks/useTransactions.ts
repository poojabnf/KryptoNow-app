import { useState, useCallback, useRef } from "react"
import { useWalletStore } from "../store/walletStore"

export type TxType =
  | "send"
  | "receive"
  | "token_send"
  | "token_receive"
  | "contract"

export type Tx = {
  hash:        string
  from:        string
  to:          string
  value:       string
  symbol:      string
  tokenName:   string
  timestamp:   number
  type:        TxType
  isERC20:     boolean
  gasUsed:     string
  gasPrice:    string
  gasCostETH:  string
  blockNumber: string
  status:      "success" | "failed" | "pending"
}

const EXPLORER_API: Record<number, string> = {
  1:     "https://api.etherscan.io/api",
  137:   "https://api.polygonscan.com/api",
  56:    "https://api.bscscan.com/api",
  42161: "https://api.arbiscan.io/api",
  10:    "https://api-optimistic.etherscan.io/api",
  8453:  "https://api.basescan.org/api",
}

const API_KEYS: Record<number, string> = {
  1:     process.env.EXPO_PUBLIC_ETHERSCAN_KEY   ?? "",
  137:   process.env.EXPO_PUBLIC_POLYGONSCAN_KEY ?? "",
  56:    process.env.EXPO_PUBLIC_BSCSCAN_KEY     ?? "",
  42161: process.env.EXPO_PUBLIC_ARBISCAN_KEY    ?? "",
  10:    process.env.EXPO_PUBLIC_OPTIMISM_KEY    ?? "",
  8453:  process.env.EXPO_PUBLIC_BASESCAN_KEY    ?? "",
}

function fromWei(value: string, decimals = 18): string {
  try {
    const n       = BigInt(value)
    const d       = BigInt(10 ** decimals)
    const whole   = n / d
    const frac    = n % d
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6)
    const result  = `${whole}.${fracStr}`
    const trimmed = result.replace(/\.?0+$/, "")
    return trimmed || "0"
  } catch {
    return "0"
  }
}

function calcGasCost(gasUsed: string, gasPrice: string): string {
  try {
    const cost = (parseInt(gasUsed) * parseInt(gasPrice)) / 1e18
    return cost.toFixed(8)
  } catch {
    return "0"
  }
}

function normaliseTx(raw: any, address: string, chainSymbol: string, chainName: string): Tx {
  const isSend    = raw.from?.toLowerCase() === address.toLowerCase()
  const gasUsed   = raw.gasUsed   ?? "0"
  const gasPrice  = raw.gasPrice  ?? "0"

  return {
    hash:        raw.hash        ?? "",
    from:        raw.from        ?? "",
    to:          raw.to          ?? "",
    value:       fromWei(raw.value || "0"),
    symbol:      chainSymbol,
    tokenName:   chainName,
    timestamp:   parseInt(raw.timeStamp ?? "0", 10),
    type:        isSend
                   ? (raw.input && raw.input !== "0x" ? "contract" : "send")
                   : "receive",
    isERC20:     false,
    gasUsed,
    gasPrice:    (parseInt(gasPrice) / 1e9).toFixed(2),
    gasCostETH:  calcGasCost(gasUsed, gasPrice),
    blockNumber: raw.blockNumber ?? "",
    status:      raw.txreceipt_status === "0" ? "failed" : "success",
  }
}

function normaliseERC20(raw: any, address: string): Tx {
  const isSend  = raw.from?.toLowerCase() === address.toLowerCase()
  const dec     = parseInt(raw.tokenDecimal ?? "18", 10)
  const gasUsed = raw.gasUsed  ?? "0"
  const gasPrice= raw.gasPrice ?? "0"

  return {
    hash:        raw.hash        ?? "",
    from:        raw.from        ?? "",
    to:          raw.to          ?? "",
    value:       fromWei(raw.value || "0", dec),
    symbol:      raw.tokenSymbol ?? "???",
    tokenName:   raw.tokenName   ?? "Unknown Token",
    timestamp:   parseInt(raw.timeStamp ?? "0", 10),
    type:        isSend ? "token_send" : "token_receive",
    isERC20:     true,
    gasUsed,
    gasPrice:    (parseInt(gasPrice) / 1e9).toFixed(2),
    gasCostETH:  calcGasCost(gasUsed, gasPrice),
    blockNumber: raw.blockNumber ?? "",
    status:      "success",
  }
}

async function fetchTxns(address: string, chainId: number, chainSymbol: string, chainName: string): Promise<Tx[]> {
  const base   = EXPLORER_API[chainId]
  const apikey = API_KEYS[chainId]
  if (!base || !address) return []

  const keyParam = apikey ? `&apikey=${apikey}` : ""

  async function get(action: string): Promise<any[]> {
    const url = `${base}?module=account&action=${action}&address=${address}&sort=desc&offset=50&page=1${keyParam}`
    try {
      const res  = await fetch(url)
      const json = await res.json()
      return Array.isArray(json.result) ? json.result : []
    } catch {
      return []
    }
  }

  const [native, erc20] = await Promise.all([
    get("txlist"),
    get("tokentx"),
  ])

  const normalised: Tx[] = [
    ...native.map(tx => normaliseTx(tx, address, chainSymbol, chainName)),
    ...erc20.map(tx  => normaliseERC20(tx, address)),
  ]

  const seen = new Set<string>()
  return normalised
    .filter(tx => { if (seen.has(tx.hash)) return false; seen.add(tx.hash); return true })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100)
}

export function useTransactions(address: string | null) {
  const activeChain = useWalletStore(s => s.activeChain)
  const [txns,        setTxns]        = useState<Tx[]>([])
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(false)
  const lastFetch = useRef<number>(0)

  const refresh = useCallback(async () => {
    if (!address) return
    if (Date.now() - lastFetch.current < 10_000) return
    lastFetch.current = Date.now()

    setLoading(true)
    setError(null)
    try {
      const data = await fetchTxns(address, activeChain.id, activeChain.symbol, activeChain.name)
      setTxns(data)
      setHasMore(data.length >= 50)
    } catch (e: any) {
      setError(e.message ?? "Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }, [address, activeChain.id, activeChain.symbol, activeChain.name])

  const loadMore = useCallback(async () => {
    // Pagination placeholder - already loaded top 100
    setHasMore(false)
  }, [])

  return { txns, loading, loadingMore, error, hasMore, refresh, loadMore }
}