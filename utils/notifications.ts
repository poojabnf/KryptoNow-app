import { Platform } from "react-native"

export interface NotifPrefs {
  priceAlerts:    boolean
  txAlerts:       boolean
  securityAlerts: boolean
  newsAlerts:     boolean
  pushEnabled:    boolean
}

export interface NotifRecord {
  id:        string
  title:     string
  body:      string
  type:      "price" | "tx" | "security" | "news"
  read:      boolean
  timestamp: number
  data?:     Record<string, string>
}

export const DEFAULT_PREFS: NotifPrefs = {
  priceAlerts:    true,
  txAlerts:       true,
  securityAlerts: true,
  newsAlerts:     false,
  pushEnabled:    false,
}

const PREFS_KEY   = "kryptonow_notif_prefs"
const HISTORY_KEY = "kryptonow_notif_history"

// --- Storage (web-compatible) ---
function storageGet(key: string): string | null {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key)
    return null
  } catch { return null }
}

function storageSet(key: string, value: string): void {
  try {
    if (Platform.OS === "web") localStorage.setItem(key, value)
  } catch {}
}

// --- Prefs ---
export function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = storageGet(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch { return DEFAULT_PREFS }
}

export function saveNotifPrefs(prefs: NotifPrefs): void {
  try { storageSet(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

// --- History ---
export function loadNotifHistory(): NotifRecord[] {
  try {
    const raw = storageGet(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as NotifRecord[]
  } catch { return [] }
}

export function saveNotifHistory(history: NotifRecord[]): void {
  try { storageSet(HISTORY_KEY, JSON.stringify(history.slice(0, 100))) } catch {}
}

export function addNotification(notif: Omit<NotifRecord, "id" | "timestamp" | "read">): void {
  try {
    const history = loadNotifHistory()
    const newNotif: NotifRecord = {
      ...notif,
      id:        Math.random().toString(36).slice(2),
      timestamp: Math.floor(Date.now() / 1000),
      read:      false,
    }
    saveNotifHistory([newNotif, ...history])
  } catch {}
}

export function markAllRead(): void {
  try {
    const history = loadNotifHistory()
    saveNotifHistory(history.map(n => ({ ...n, read: true })))
  } catch {}
}

export function markOneRead(id: string): void {
  try {
    const history = loadNotifHistory()
    saveNotifHistory(history.map(n => n.id === id ? { ...n, read: true } : n))
  } catch {}
}

export function clearAllNotifications(): void {
  try { storageSet(HISTORY_KEY, "[]") } catch {}
}

export function getUnreadCount(): number {
  try {
    return loadNotifHistory().filter(n => !n.read).length
  } catch { return 0 }
}

// --- Demo notifications (for testing) ---
export function seedDemoNotifications(): void {
  const existing = loadNotifHistory()
  if (existing.length > 0) return

  const demos: Omit<NotifRecord, "id">[] = [
    {
      title:     "ETH Received",
      body:      "You received 0.05 ETH (~$120) on Ethereum",
      type:      "tx",
      read:      false,
      timestamp: Math.floor(Date.now() / 1000) - 300,
    },
    {
      title:     "Price Alert",
      body:      "ETH dropped below $3,000  now at $2,980",
      type:      "price",
      read:      false,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    },
    {
      title:     "Swap Complete",
      body:      "Swapped 100 USDC for 0.042 ETH via 1inch",
      type:      "tx",
      read:      true,
      timestamp: Math.floor(Date.now() / 1000) - 86400,
    },
    {
      title:     "Security Notice",
      body:      "New sign-in detected on your Kryptonow account",
      type:      "security",
      read:      true,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
    },
    {
      title:     "BNB Price Alert",
      body:      "BNB crossed above $600  now at $612",
      type:      "price",
      read:      true,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
    },
  ]

  const records: NotifRecord[] = demos.map(d => ({
    ...d,
    id: Math.random().toString(36).slice(2),
  }))
  saveNotifHistory(records)
}

// --- Price alert checker ---
export async function checkPriceAlerts(prefs: NotifPrefs): Promise<void> {
  if (!prefs.priceAlerts) return
  try {
    const res  = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network&vs_currencies=usd")
    const data = await res.json()
    const eth  = data?.ethereum?.usd ?? 0
    const bnb  = data?.binancecoin?.usd ?? 0
    const matic= data?.["matic-network"]?.usd ?? 0

    // Example thresholds  in a real app these would be user-configurable
    const LAST_KEY = "kryptonow_last_prices"
    const lastRaw  = storageGet(LAST_KEY)
    const last     = lastRaw ? JSON.parse(lastRaw) : {}

    if (last.eth && Math.abs(eth - last.eth) / last.eth > 0.05) {
      const dir = eth > last.eth ? "surged above" : "dropped below"
      addNotification({
        title: "ETH Price Alert",
        body:  `ETH has ${dir} ${last.eth > eth ? "$" + last.eth.toFixed(0) : "$" + eth.toFixed(0)}  now $${eth.toFixed(0)}`,
        type:  "price",
      })
    }

    storageSet(LAST_KEY, JSON.stringify({ eth, bnb, matic }))
  } catch {}
}