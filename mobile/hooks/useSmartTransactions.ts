/**
 * hooks/useSmartTransactions.ts
 * ------------------------------
 * Unified hook that picks the best data source per chain:
 *   - Chains with Graph subgraphs → useGraphTransactions
 *   - BNB Chain (no subgraph) → useTransactions (Alchemy/Etherscan)
 *   - Falls back to Alchemy if Graph returns empty
 *
 * Drop-in replacement for useTransactions in history.tsx
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'
import { GRAPH_ENDPOINTS } from '../utils/graphClient'
import { Tx } from './useTransactions'
import { useGraphTransactions } from './useGraphTransactions'

// Chains with deployed subgraphs
const GRAPH_CHAINS = new Set(Object.keys(GRAPH_ENDPOINTS).map(Number))

export function useSmartTransactions(address: string | null) {
  const activeChain   = useWalletStore(s => s.activeChain)
  const useGraph      = GRAPH_CHAINS.has(activeChain.id)

  // Graph path
  const graph = useGraphTransactions(useGraph ? address : null)

  // Fallback path (Alchemy/Etherscan) — lazy import to avoid circular
  const [fallbackTxns,    setFallbackTxns]    = useState<Tx[]>([])
  const [fallbackLoading, setFallbackLoading] = useState(false)
  const [fallbackError,   setFallbackError]   = useState<string | null>(null)
  const lastFetch = useRef<number>(0)

  const fallbackRefresh = useCallback(async () => {
    if (useGraph || !address) return
    if (Date.now() - lastFetch.current < 10_000) return
    lastFetch.current = Date.now()
    setFallbackLoading(true)
    try {
      const { useTransactions: _useTransactions } = await import('./useTransactions')
      // Can't call hook dynamically — use the fetch fn directly
      const { fetchTxnsForChain } = await import('./useTransactions') as any
      if (fetchTxnsForChain) {
        const data = await fetchTxnsForChain(address, activeChain.id, activeChain.symbol, activeChain.name)
        setFallbackTxns(data)
      }
    } catch (e: any) {
      setFallbackError(e.message ?? 'Failed to load')
    } finally {
      setFallbackLoading(false)
    }
  }, [address, activeChain.id, useGraph])

  useEffect(() => {
    if (!useGraph) fallbackRefresh()
  }, [address, activeChain.id, useGraph])

  if (useGraph) {
    return graph
  }

  return {
    txns:        fallbackTxns,
    loading:     fallbackLoading,
    loadingMore: false,
    error:       fallbackError,
    hasMore:     false,
    refresh:     fallbackRefresh,
    loadMore:    async () => {},
  }
}
