import { useState, useEffect, useRef } from 'react'
import { COINGECKO_IDS } from '../constants/coinGeckoIdMap'

export interface PortfolioToken {
  symbol: string
  name: string
  chain: string
  chainColor: string
  balance: number
  priceUSD: number
  valueUSD: number
  pct: number
}

export interface ChainAllocation {
  chain: string
  color: string
  valueUSD: number
  pct: number
}

export interface PortfolioData {
  tokens: PortfolioToken[]
  byChain: ChainAllocation[]
  totalUSD: number
  loading: boolean
  error: string | null
}

export function usePortfolio(rawTokens: { symbol: string; name: string; chain: string; chainColor: string; balance: number }[]): PortfolioData {
  const [tokens, setTokens]   = useState<PortfolioToken[]>([])
  const [totalUSD, setTotal]  = useState(0)
  const [byChain, setByChain] = useState<ChainAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const cache = useRef<Record<string, { price: number; fetchedAt: number }>>({})
  const TTL = 60 * 1000

  useEffect(() => {
    if (!rawTokens.length) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    const unique = [...new Set(rawTokens.map(t => t.symbol.toUpperCase()))]
    const ids = unique.map(s => COINGECKO_IDS[s] ?? s.toLowerCase())
    const now = Date.now()
    const stale = ids.filter(id => {
      const c = cache.current[id]
      return !c || now - c.fetchedAt > TTL
    })

    const fetchPrices = stale.length > 0
      ? fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + stale.join(',') + '&vs_currencies=usd')
          .then(r => { if (!r.ok) throw new Error('CoinGecko ' + r.status); return r.json() })
          .then((json: Record<string, { usd: number }>) => {
            Object.entries(json).forEach(([id, v]) => {
              cache.current[id] = { price: v.usd, fetchedAt: Date.now() }
            })
          })
      : Promise.resolve()

    fetchPrices
      .then(() => {
        if (cancelled) return
        const enriched: PortfolioToken[] = rawTokens.map(t => {
          const id = COINGECKO_IDS[t.symbol.toUpperCase()] ?? t.symbol.toLowerCase()
          const price = cache.current[id]?.price ?? 0
          return { ...t, priceUSD: price, valueUSD: t.balance * price, pct: 0 }
        })
        const total = enriched.reduce((s, t) => s + t.valueUSD, 0)
        const withPct = enriched
          .map(t => ({ ...t, pct: total > 0 ? (t.valueUSD / total) * 100 : 0 }))
          .sort((a, b) => b.valueUSD - a.valueUSD)

        const chainMap: Record<string, { color: string; valueUSD: number }> = {}
        withPct.forEach(t => {
          if (!chainMap[t.chain]) chainMap[t.chain] = { color: t.chainColor, valueUSD: 0 }
          chainMap[t.chain].valueUSD += t.valueUSD
        })
        const chains: ChainAllocation[] = Object.entries(chainMap)
          .map(([chain, v]) => ({ chain, color: v.color, valueUSD: v.valueUSD, pct: total > 0 ? (v.valueUSD / total) * 100 : 0 }))
          .sort((a, b) => b.valueUSD - a.valueUSD)

        setTokens(withPct)
        setTotal(total)
        setByChain(chains)
        setError(null)
      })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Failed to load prices') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [JSON.stringify(rawTokens.map(t => t.symbol + '-' + t.balance))])

  return { tokens, byChain, totalUSD, loading, error }
}
