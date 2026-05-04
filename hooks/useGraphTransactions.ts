/**
 * hooks/useGraphTransactions.ts
 * ------------------------------
 * Fetches transaction history from The Graph subgraphs.
 * Covers:
 *   - Native ETH transfers
 *   - ERC-20 token transfers
 *   - ERC-4337 UserOperations (smart account ops)
 *
 * Falls back to existing Alchemy/Etherscan hook for unsupported chains (BNB).
 */

import { useState, useCallback, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'
import { graphQuery, GRAPH_ENDPOINTS, USEROP_ENDPOINTS } from '../utils/graphClient'
import { Tx, TxType } from './useTransactions'

//  GraphQL queries 

const NATIVE_TX_QUERY = `
  query NativeTxs($address: String!, $first: Int!, $skip: Int!) {
    account(id: $address) {
      sentTransactions: transactions(
        first: $first skip: $skip
        orderBy: timestamp orderDirection: desc
        where: { value_gt: "0" }
      ) {
        hash from { id } to { id } value
        gasUsed gasPrice blockNumber timestamp
        status
      }
      receivedTransactions: transactionsTo(
        first: $first skip: $skip
        orderBy: timestamp orderDirection: desc
        where: { value_gt: "0" }
      ) {
        hash from { id } to { id } value
        gasUsed gasPrice blockNumber timestamp
        status
      }
    }
  }
`

const ERC20_TRANSFER_QUERY = `
  query ERC20Transfers($address: String!, $first: Int!, $skip: Int!) {
    account(id: $address) {
      transfersFrom: transfersSent(
        first: $first skip: $skip
        orderBy: timestamp orderDirection: desc
      ) {
        id
        transaction { hash timestamp blockNumber gasUsed gasPrice }
        to { id }
        from { id }
        amount
        token { symbol name decimals }
      }
      transfersTo: transfersReceived(
        first: $first skip: $skip
        orderBy: timestamp orderDirection: desc
      ) {
        id
        transaction { hash timestamp blockNumber gasUsed gasPrice }
        to { id }
        from { id }
        amount
        token { symbol name decimals }
      }
    }
  }
`

const USEROP_QUERY = `
  query UserOps($sender: String!, $first: Int!) {
    userOperationEvents(
      first: $first
      orderBy: blockTimestamp orderDirection: desc
      where: { sender: $sender }
    ) {
      id
      userOpHash
      sender
      paymaster
      nonce
      success
      actualGasCost
      actualGasUsed
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`

//  Normalise helpers 

function fromWei(value: string, decimals = 18): string {
  try {
    const n       = BigInt(value || '0')
    const d       = BigInt(10 ** Math.min(decimals, 18))
    const whole   = n / d
    const frac    = n % d
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6)
    return `${whole}.${fracStr}`.replace(/\.?0+$/, '') || '0'
  } catch { return '0' }
}

function calcGasCost(gasUsed: string, gasPrice: string): string {
  try {
    return ((parseInt(gasUsed || '0') * parseInt(gasPrice || '0')) / 1e18).toFixed(8)
  } catch { return '0' }
}

function normNative(raw: any, address: string, chainSymbol: string, chainName: string): Tx {
  const isSend = raw.from?.id?.toLowerCase() === address.toLowerCase()
  return {
    hash:        raw.hash ?? '',
    from:        raw.from?.id ?? '',
    to:          raw.to?.id ?? '',
    value:       fromWei(raw.value ?? '0'),
    symbol:      chainSymbol,
    tokenName:   chainName,
    timestamp:   parseInt(raw.timestamp ?? '0', 10),
    type:        isSend ? 'send' : 'receive',
    isERC20:     false,
    gasUsed:     raw.gasUsed ?? '0',
    gasPrice:    ((parseInt(raw.gasPrice ?? '0')) / 1e9).toFixed(2),
    gasCostETH:  calcGasCost(raw.gasUsed ?? '0', raw.gasPrice ?? '0'),
    blockNumber: raw.blockNumber ?? '',
    status:      raw.status === 'FAILED' ? 'failed' : 'success',
  }
}

function normERC20(raw: any, address: string, isSend: boolean): Tx {
  const tx  = raw.transaction ?? {}
  const dec = parseInt(raw.token?.decimals ?? '18', 10)
  return {
    hash:        tx.hash ?? '',
    from:        raw.from?.id ?? '',
    to:          raw.to?.id ?? '',
    value:       fromWei(raw.amount ?? '0', dec),
    symbol:      raw.token?.symbol ?? '???',
    tokenName:   raw.token?.name ?? 'Unknown Token',
    timestamp:   parseInt(tx.timestamp ?? '0', 10),
    type:        isSend ? 'token_send' : 'token_receive',
    isERC20:     true,
    gasUsed:     tx.gasUsed ?? '0',
    gasPrice:    ((parseInt(tx.gasPrice ?? '0')) / 1e9).toFixed(2),
    gasCostETH:  calcGasCost(tx.gasUsed ?? '0', tx.gasPrice ?? '0'),
    blockNumber: tx.blockNumber ?? '',
    status:      'success',
  }
}

function normUserOp(raw: any): Tx {
  const gasCostETH = ((parseInt(raw.actualGasCost ?? '0')) / 1e18).toFixed(8)
  return {
    hash:        raw.transactionHash ?? '',
    from:        raw.sender ?? '',
    to:          raw.paymaster ?? raw.sender ?? '',
    value:       '0',
    symbol:      'ETH',
    tokenName:   'UserOperation',
    timestamp:   parseInt(raw.blockTimestamp ?? '0', 10),
    type:        'contract',
    isERC20:     false,
    gasUsed:     raw.actualGasUsed ?? '0',
    gasPrice:    '0',
    gasCostETH,
    blockNumber: raw.blockNumber ?? '',
    status:      raw.success ? 'success' : 'failed',
  }
}

//  Fetchers 

async function fetchGraphTxns(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  chainName:   string,
  skip = 0,
): Promise<Tx[]> {
  const endpoint = GRAPH_ENDPOINTS[chainId]
  if (!endpoint) return []

  const addrLower = address.toLowerCase()
  const vars = { address: addrLower, first: 50, skip }

  const [nativeData, erc20Data] = await Promise.all([
    graphQuery<any>(endpoint, NATIVE_TX_QUERY, vars).catch(() => null),
    graphQuery<any>(endpoint, ERC20_TRANSFER_QUERY, vars).catch(() => null),
  ])

  const txns: Tx[] = []

  // Native txs
  const acct = nativeData?.account
  if (acct) {
    ;(acct.sentTransactions ?? []).forEach((tx: any) =>
      txns.push(normNative(tx, address, chainSymbol, chainName))
    )
    ;(acct.receivedTransactions ?? []).forEach((tx: any) =>
      txns.push(normNative(tx, address, chainSymbol, chainName))
    )
  }

  // ERC-20 transfers
  const acct2 = erc20Data?.account
  if (acct2) {
    ;(acct2.transfersFrom ?? []).forEach((t: any) =>
      txns.push(normERC20(t, address, true))
    )
    ;(acct2.transfersTo ?? []).forEach((t: any) =>
      txns.push(normERC20(t, address, false))
    )
  }

  return txns
}

async function fetchUserOps(
  address: string,
  chainId: number,
): Promise<Tx[]> {
  const endpoint = USEROP_ENDPOINTS[chainId]
  if (!endpoint) return []

  try {
    const data = await graphQuery<any>(endpoint, USEROP_QUERY, {
      sender: address.toLowerCase(),
      first:  50,
    })
    return (data?.userOperationEvents ?? []).map(normUserOp)
  } catch {
    return []
  }
}

//  Dedup + sort 

function dedup(txns: Tx[]): Tx[] {
  const seen = new Set<string>()
  return txns.filter(tx => {
    const key = `${tx.hash}-${tx.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => b.timestamp - a.timestamp)
}

//  Hook 

export function useGraphTransactions(address: string | null) {
  const activeChain = useWalletStore(s => s.activeChain)
  const [txns,        setTxns]        = useState<Tx[]>([])
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [hasMore,     setHasMore]     = useState(false)
  const [skip,        setSkip]        = useState(0)
  const lastFetch = useRef<number>(0)

  const refresh = useCallback(async () => {
    if (!address) return
    if (Date.now() - lastFetch.current < 10_000) return
    lastFetch.current = Date.now()

    setLoading(true)
    setError(null)
    setSkip(0)

    try {
      const [graphTxns, userOps] = await Promise.all([
        fetchGraphTxns(
          address,
          activeChain.id,
          activeChain.symbol,
          activeChain.name,
          0,
        ),
        fetchUserOps(address, activeChain.id),
      ])

      const merged = dedup([...graphTxns, ...userOps])
      setTxns(merged)
      setHasMore(graphTxns.length >= 50)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [address, activeChain.id, activeChain.symbol, activeChain.name])

  const loadMore = useCallback(async () => {
    if (!address || loadingMore) return
    setLoadingMore(true)
    const nextSkip = skip + 50

    try {
      const more = await fetchGraphTxns(
        address,
        activeChain.id,
        activeChain.symbol,
        activeChain.name,
        nextSkip,
      )
      setTxns(prev => dedup([...prev, ...more]))
      setSkip(nextSkip)
      setHasMore(more.length >= 50)
    } catch {}
    finally { setLoadingMore(false) }
  }, [address, activeChain.id, activeChain.symbol, activeChain.name, skip, loadingMore])

  return { txns, loading, loadingMore, error, hasMore, refresh, loadMore }
}
