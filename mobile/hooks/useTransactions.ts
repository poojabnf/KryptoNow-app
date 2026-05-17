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

// --- Alchemy RPC endpoints (uses existing Alchemy key) ---
const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? ""

const ALCHEMY_RPC: Record<number, string> = {
  1:     `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  137:   `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  10:    `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  8453:  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
}

// BNB Chain uses Etherscan V2 (no Alchemy support)
const ETHERSCAN_V2  = "https://api.etherscan.io/v2/api"
const ETHERSCAN_KEY = process.env.EXPO_PUBLIC_ETHERSCAN_KEY ?? ""

// --- Alchemy getAssetTransfers ---
async function fetchAlchemyTransfers(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string,
): Promise<Tx[]> {
  const rpc = ALCHEMY_RPC[chainId]
  if (!rpc) return []

  async function getTransfers(category: string[], fromAddress?: string, toAddress?: string): Promise<any[]> {
    const body = {
      jsonrpc: "2.0",
      id:      1,
      method:  "alchemy_getAssetTransfers",
      params:  [{
        fromBlock:       "0x0",
        toBlock:         "latest",
        ...(fromAddress ? { fromAddress } : {}),
        ...(toAddress   ? { toAddress   } : {}),
        category,
        withMetadata:    true,
        excludeZeroValue: true,
        maxCount:        "0x32", // 50
        order:           "desc",
      }],
    }
    try {
      const res  = await fetch(rpc, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      return json?.result?.transfers ?? []
    } catch { return [] }
  }

  // Fetch sent + received in parallel (native + ERC20 + ERC721)
  const categories = ["external", "erc20", "erc721", "erc1155", "specialnft"]
  const [sent, received] = await Promise.all([
    getTransfers(categories, address, undefined),
    getTransfers(categories, undefined, address),
  ])

  const normalise = (raw: any, isSend: boolean): Tx => {
    const isERC20   = raw.category === "erc20"
    const isNative  = raw.category === "external"
    const symbol    = isNative ? chainSymbol : (raw.asset ?? "???")
    const tokenName = isNative ? chainName   : (raw.asset ?? "Unknown Token")
    const value     = raw.value != null ? String(parseFloat(raw.value).toFixed(8)) : "0"

    // timestamp from metadata
    const ts = raw.metadata?.blockTimestamp
      ? Math.floor(new Date(raw.metadata.blockTimestamp).getTime() / 1000)
      : 0

    return {
      hash:        raw.hash        ?? "",
      from:        raw.from        ?? "",
      to:          raw.to          ?? "",
      value,
      symbol,
      tokenName,
      timestamp:   ts,
      type:        isSend
                     ? (isNative ? "send" : isERC20 ? "token_send" : "contract")
                     : (isNative ? "receive" : "token_receive"),
      isERC20,
      gasUsed:     "0",
      gasPrice:    "0",
      gasCostETH:  "0",
      blockNumber: raw.blockNum   ?? "",
      status:      "success",
    }
  }

  const all: Tx[] = [
    ...sent.map(t     => normalise(t, true)),
    ...received.map(t => normalise(t, false)),
  ]

  // Deduplicate by hash + type
  const seen = new Set<string>()
  return all
    .filter(tx => {
      const key = `${tx.hash}-${tx.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100)
}

// --- Etherscan V2 fallback (BNB Chain + chains without Alchemy) ---
async function fetchEtherscanTransfers(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string,
): Promise<Tx[]> {
  const keyParam   = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : ""
  const chainParam = `&chainid=${chainId}`

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

  function calcGas(gasUsed: string, gasPrice: string): string {
    try { return ((parseInt(gasUsed) * parseInt(gasPrice)) / 1e18).toFixed(8) }
    catch { return "0" }
  }

  async function get(action: string): Promise<any[]> {
    const url = `${ETHERSCAN_V2}?module=account&action=${action}&address=${address}&sort=desc&offset=50&page=1${chainParam}${keyParam}`
    try {
      const res  = await fetch(url)
      const json = await res.json()
      return Array.isArray(json.result) ? json.result : []
    } catch { return [] }
  }

  const [native, erc20] = await Promise.all([get("txlist"), get("tokentx")])

  const normNative = (raw: any): Tx => {
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
      type:        isSend ? (raw.input && raw.input !== "0x" ? "contract" : "send") : "receive",
      isERC20:     false,
      gasUsed,
      gasPrice:    (parseInt(gasPrice) / 1e9).toFixed(2),
      gasCostETH:  calcGas(gasUsed, gasPrice),
      blockNumber: raw.blockNumber ?? "",
      status:      raw.txreceipt_status === "0" ? "failed" : "success",
    }
  }

  const normERC20 = (raw: any): Tx => {
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
      gasCostETH:  calcGas(gasUsed, gasPrice),
      blockNumber: raw.blockNumber ?? "",
      status:      "success",
    }
  }

  const all: Tx[] = [
    ...native.map(normNative),
    ...erc20.map(normERC20),
  ]

  const seen = new Set<string>()
  return all
    .filter(tx => { if (seen.has(tx.hash)) return false; seen.add(tx.hash); return true })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100)
}

// --- Smart fetcher: Alchemy for 5 chains, Etherscan for BNB ---
// Exported so useSmartTransactions can call it directly for BNB Chain
export async function fetchTxnsForChain(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string,
): Promise<Tx[]> {
  return fetchTxns(address, chainId, chainSymbol, chainName)
}

async function fetchTxns(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string,
): Promise<Tx[]> {
  if (!address) return []

  // BNB Chain: use Etherscan V2
  if (chainId === 56) {
    return fetchEtherscanTransfers(address, chainId, chainSymbol, chainName)
  }

  // All other chains: try Alchemy first, fall back to Etherscan
  try {
    const alchemyTxns = await fetchAlchemyTransfers(address, chainId, chainSymbol, chainName)
    if (alchemyTxns.length > 0) return alchemyTxns

    // Alchemy returned nothing (possibly new wallet) - try Etherscan as fallback
    return fetchEtherscanTransfers(address, chainId, chainSymbol, chainName)
  } catch {
    return fetchEtherscanTransfers(address, chainId, chainSymbol, chainName)
  }
}

// --- Hook ---
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
      const data = await fetchTxns(
        address,
        activeChain.id,
        activeChain.symbol,
        activeChain.name,
      )
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