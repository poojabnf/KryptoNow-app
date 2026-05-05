/**
 * hooks/useGuardianRegistry.ts
 * Queries GuardianRegistry subgraph for on-chain guardian state.
 * Merges with local config for unified view.
 */
import { useState, useCallback } from 'react'
import { graphQuery } from '../utils/graphClient'
import addresses from '../utils/guardianRegistryAddresses.json'

const REGISTRY_SUBGRAPH: Record<number, string> = {
  1:     'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-mainnet',
  137:   'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-polygon',
  42161: 'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-arbitrum',
  10:    'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-optimism',
  8453:  'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-base',
}

const GUARDIAN_QUERY = `
  query Guardians($smartAccount: Bytes!) {
    smartAccountConfig(id: $smartAccount) {
      guardians
      threshold
      updatedAt
    }
    recoveryInitiateds(
      where: { smartAccount: $smartAccount }
      orderBy: timestamp orderDirection: desc
      first: 10
    ) {
      requestId newOwner deadline timestamp txHash
    }
    recoveryExecuteds(
      where: { smartAccount: $smartAccount }
      first: 5
    ) {
      requestId newOwner timestamp txHash
    }
  }
`

export interface OnChainGuardianState {
  guardians:    string[]
  threshold:    number
  updatedAt:    number
  pendingRequests: {
    requestId: string
    newOwner:  string
    deadline:  number
    timestamp: number
    txHash:    string
  }[]
  executedRequests: {
    requestId: string
    newOwner:  string
    timestamp: number
    txHash:    string
  }[]
}

export function useGuardianRegistry(smartAccountAddr: string | null, chainId: number) {
  const [state,   setState]   = useState<OnChainGuardianState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const contractAddr = (addresses as any)[String(chainId)]
  const subgraphUrl  = REGISTRY_SUBGRAPH[chainId]
  const isDeployed   = contractAddr && contractAddr !== '0x0000000000000000000000000000000000000000'

  const refresh = useCallback(async () => {
    if (!smartAccountAddr || !subgraphUrl || !isDeployed) return
    setLoading(true)
    setError(null)
    try {
      const data = await graphQuery<any>(subgraphUrl, GUARDIAN_QUERY, {
        smartAccount: smartAccountAddr.toLowerCase(),
      })
      const cfg = data?.smartAccountConfig
      setState({
        guardians:    cfg?.guardians ?? [],
        threshold:    cfg?.threshold ?? 1,
        updatedAt:    parseInt(cfg?.updatedAt ?? '0'),
        pendingRequests: (data?.recoveryInitiateds ?? []).map((r: any) => ({
          requestId: r.requestId,
          newOwner:  r.newOwner,
          deadline:  parseInt(r.deadline),
          timestamp: parseInt(r.timestamp),
          txHash:    r.txHash,
        })),
        executedRequests: (data?.recoveryExecuteds ?? []).map((r: any) => ({
          requestId: r.requestId,
          newOwner:  r.newOwner,
          timestamp: parseInt(r.timestamp),
          txHash:    r.txHash,
        })),
      })
    } catch (e: any) {
      setError(e.message ?? 'Failed to load on-chain guardian state')
    } finally {
      setLoading(false)
    }
  }, [smartAccountAddr, chainId, subgraphUrl, isDeployed])

  return { state, loading, error, refresh, isDeployed, contractAddr }
}
