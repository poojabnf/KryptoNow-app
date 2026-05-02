import { useState, useEffect, useRef } from 'react';

export type Range = '1' | '7' | '30' | '90';

interface PricePoint { time: number; value: number; }

export function usePriceChart(coinId: string, range: Range) {
  const [data, setData]       = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const cache = useRef<Record<string, PricePoint[]>>({});

  useEffect(() => {
    const key = `${coinId}-${range}`;
    if (cache.current[key]) {
      setData(cache.current[key]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart` +
      `?vs_currency=usd&days=${range}&interval=${range === '1' ? 'hourly' : 'daily'}`
    )
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const points: PricePoint[] = json.prices.map(
          ([ts, price]: [number, number]) => ({ time: Math.floor(ts / 1000), value: price })
        );
        cache.current[key] = { points, fetchedAt: Date.now() };
        setData(points);
      })
      .catch(() => { if (!cancelled) setError('Failed to load price data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [coinId, range]);

  return { data, loading, error };
}