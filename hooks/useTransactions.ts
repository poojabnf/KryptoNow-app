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

// ONE Etherscan V2 endpoint covers ALL chains via chainid param
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api"

// Chain IDs map directly to Etherscan V2 chainid param
const SUPPORTED_CHAINS = new Set([1, 137, 42161, 10, 8453, 56])

function fromWei(value: string, decimals = 18): string {
  try {
    const n       = BigInt(value)
    const d       = BigInt(10 ** decimals)
    const whole   = n / d
    const frac    = n % d
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6)
    return `${whole}.${fracStr}`.replace(/\.?0+$/, "") || "0"
  } catch { return "0" }
}

function calcGasCost(gasUsed: string, gasPrice: string): string {
  try {
    return ((parseInt(gasUsed) * parseInt(gasPrice)) / 1e18).toFixed(8)
  } catch { return "0" }
}

function normaliseTx(raw: any, address: string, chainSymbol: string, chainName: string): Tx {
  const isSend  = raw.from?.toLowerCase() === address.toLowerCase()
  const gasUsed = raw.gasUsed  ?? "0"
  const gasPrice= raw.gasPrice ?? "0"
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

async function fetchTxns(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string
): Promise<Tx[]> {
  if (!SUPPORTED_CHAINS.has(chainId) || !address) return []

  const apiKey     = process.env.EXPO_PUBLIC_ETHERSCAN_KEY ?? ""
  const keyParam   = apiKey ? `&apikey=${apiKey}` : ""
  const chainParam = `&chainid=${chainId}`

  async function get(action: string): Promise<any[]> {
    const url = `${ETHERSCAN_V2}?module=account&action=${action}&address=${address}&sort=desc&offset=50&page=1${chainParam}${keyParam}`
    try {
      const res  = await fetch(url)
      const json = await res.json()
      return Array.isArray(json.result) ? json.result : []
    } catch { return [] }
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
    setHasMore(false)
  }, [])

  return { txns, loading, loadingMore, error, hasMore, refresh, loadMore }
}