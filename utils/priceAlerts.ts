/**
 * utils/priceAlerts.ts
 * Custom price alert thresholds - user configurable
 * Persists to localStorage, checked every 5 mins
 */
import { addNotification } from "./notifications"
import { sendPushNotification } from "./pushService"

export type AlertCondition = "above" | "below"
export type AlertFrequency = "once" | "always"

export type PriceAlert = {
  id:         string
  coinId:     string       // coingecko id e.g. "ethereum"
  symbol:     string       // e.g. "ETH"
  name:       string       // e.g. "Ethereum"
  condition:  AlertCondition
  threshold:  number       // price in USD
  frequency:  AlertFrequency
  enabled:    boolean
  triggered:  boolean      // for "once" alerts
  createdAt:  number
  lastTriggeredAt?: number
}

const ALERTS_KEY    = "kryptonow_price_alerts"
const LAST_CHECK_KEY = "kryptonow_price_alert_last_check"

// --- Supported tokens ---
export const ALERT_TOKENS = [
  { coinId: "bitcoin",        symbol: "BTC",  name: "Bitcoin",   color: "#F7931A" },
  { coinId: "ethereum",       symbol: "ETH",  name: "Ethereum",  color: "#627EEA" },
  { coinId: "binancecoin",    symbol: "BNB",  name: "BNB",       color: "#F0B90B" },
  { coinId: "matic-network",  symbol: "MATIC",name: "Polygon",   color: "#8247E5" },
  { coinId: "solana",         symbol: "SOL",  name: "Solana",    color: "#9945FF" },
  { coinId: "ripple",         symbol: "XRP",  name: "XRP",       color: "#0085C0" },
  { coinId: "cardano",        symbol: "ADA",  name: "Cardano",   color: "#0033AD" },
  { coinId: "avalanche-2",    symbol: "AVAX", name: "Avalanche", color: "#E84142" },
  { coinId: "usd-coin",       symbol: "USDC", name: "USD Coin",  color: "#2775CA" },
  { coinId: "tether",         symbol: "USDT", name: "Tether",    color: "#26A17B" },
]

// --- Storage ---
export function loadPriceAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function savePriceAlerts(alerts: PriceAlert[]): void {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)) } catch {}
}

export function addPriceAlert(alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">): PriceAlert {
  const alerts = loadPriceAlerts()
  const newAlert: PriceAlert = {
    ...alert,
    id:        Math.random().toString(36).slice(2),
    createdAt: Date.now(),
    triggered: false,
  }
  savePriceAlerts([newAlert, ...alerts])
  return newAlert
}

export function updatePriceAlert(id: string, changes: Partial<PriceAlert>): void {
  const alerts = loadPriceAlerts()
  savePriceAlerts(alerts.map(a => a.id === id ? { ...a, ...changes } : a))
}

export function deletePriceAlert(id: string): void {
  savePriceAlerts(loadPriceAlerts().filter(a => a.id !== id))
}

export function togglePriceAlert(id: string): void {
  const alerts = loadPriceAlerts()
  savePriceAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
}

// --- Price fetcher ---
export async function fetchCurrentPrices(): Promise<Record<string, number>> {
  try {
    const ids = ALERT_TOKENS.map(t => t.coinId).join(",")
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    )
    const data = await res.json()
    const prices: Record<string, number> = {}
    for (const token of ALERT_TOKENS) {
      prices[token.coinId] = data[token.coinId]?.usd ?? 0
    }
    return prices
  } catch { return {} }
}

// --- Alert checker ---
export async function checkCustomPriceAlerts(): Promise<number> {
  const alerts = loadPriceAlerts().filter(a => a.enabled && !a.triggered)
  if (!alerts.length) return 0

  const prices = await fetchCurrentPrices()
  let triggered = 0

  const updated = loadPriceAlerts()

  for (const alert of alerts) {
    const price = prices[alert.coinId]
    if (!price) continue

    const shouldFire =
      (alert.condition === "above" && price >= alert.threshold) ||
      (alert.condition === "below" && price <= alert.threshold)

    if (!shouldFire) continue

    // Fire notification
    const dir = alert.condition === "above" ? "risen above" : "fallen below"
    const title = `${alert.symbol} Price Alert`
    const body  = `${alert.name} has ${dir} $${alert.threshold.toLocaleString()}  now $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    addNotification({ title, body, type: "price" })

    try {
      await sendPushNotification(title, body, "price")
    } catch {}

    // Update alert state
    const idx = updated.findIndex(a => a.id === alert.id)
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        triggered:        alert.frequency === "once",
        lastTriggeredAt:  Date.now(),
      }
    }

    triggered++
  }

  if (triggered > 0) savePriceAlerts(updated)
  localStorage.setItem(LAST_CHECK_KEY, Date.now().toString())
  return triggered
}

export function getLastCheckTime(): number {
  try { return parseInt(localStorage.getItem(LAST_CHECK_KEY) ?? "0") } catch { return 0 }
}