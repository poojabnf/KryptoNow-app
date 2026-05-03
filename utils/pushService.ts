/**
 * utils/pushService.ts
 * --------------------
 * Real push notifications using expo-notifications (web + native)
 * Web: uses browser Notification API
 * Native: uses Expo push notification service
 */
import { Platform } from "react-native"
import { addNotification, loadNotifPrefs } from "./notifications"

// --- Web Browser Push (no FCM needed) ---
async function requestWebPermission(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return false
    if (Notification.permission === "granted") return true
    if (Notification.permission === "denied") return false
    const result = await Notification.requestPermission()
    return result === "granted"
  } catch { return false }
}

function sendWebNotification(title: string, body: string, type: string): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const icons: Record<string, string> = {
      tx:       "/icon-tx.png",
      price:    "/icon-price.png",
      security: "/icon-security.png",
      news:     "/icon-news.png",
    }

    new Notification(title, {
      body,
      icon:   icons[type] ?? "/icon.png",
      badge:  "/badge.png",
      tag:    `kryptonow-${type}-${Date.now()}`,
      silent: false,
    })
  } catch {}
}

// --- Native Push (expo-notifications) ---
async function requestNativePermission(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications")
    const Device        = await import("expo-device")

    if (!Device.default.isDevice) return null

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") return null

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    })

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID ?? "",
    })

    // Save token to localStorage for backend use
    try { localStorage.setItem("kryptonow_push_token", token.data) } catch {}

    return token.data
  } catch { return null }
}

// --- Schedule local native notification ---
async function scheduleLocalNotification(title: string, body: string): Promise<void> {
  try {
    const Notifications = await import("expo-notifications")
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // fire immediately
    })
  } catch {}
}

// --- Main API ---

/**
 * Request push permission (web + native)
 * Call this when user enables push in settings
 */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    return requestWebPermission()
  }
  const token = await requestNativePermission()
  return token != null
}

/**
 * Send a push notification + add to in-app inbox
 * Works on web (browser notification) and native (local notification)
 */
export async function sendPushNotification(
  title: string,
  body:  string,
  type:  "tx" | "price" | "security" | "news",
): Promise<void> {
  const prefs = loadNotifPrefs()
  if (!prefs.pushEnabled) return

  // Check type preference
  if (type === "tx"       && !prefs.txAlerts)       return
  if (type === "price"    && !prefs.priceAlerts)     return
  if (type === "security" && !prefs.securityAlerts)  return
  if (type === "news"     && !prefs.newsAlerts)       return

  // Add to in-app inbox always
  addNotification({ title, body, type })

  // Send platform push
  if (Platform.OS === "web") {
    sendWebNotification(title, body, type)
  } else {
    await scheduleLocalNotification(title, body)
  }
}

/**
 * Watch wallet for new transactions and fire alerts
 * Call this on dashboard mount - polls every 60s
 */
export function startTxWatcher(
  address:     string,
  chainId:     number,
  chainSymbol: string,
  onNewTx:     (count: number) => void,
): () => void {
  const LAST_KEY = `kryptonow_last_tx_${chainId}_${address.slice(-6)}`
  const prefs    = loadNotifPrefs()

  if (!prefs.txAlerts || !prefs.pushEnabled) return () => {}

  const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? "t7T7fcsMA4rqQYH70YRV3"
  const ALCHEMY_RPC: Record<number, string> = {
    1:     `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    137:   `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    10:    `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    8453:  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  }

  async function checkNewTxns() {
    const rpc = ALCHEMY_RPC[chainId]
    if (!rpc) return

    try {
      const lastHash = localStorage.getItem(LAST_KEY) ?? ""

      const body = {
        jsonrpc: "2.0", id: 1,
        method:  "alchemy_getAssetTransfers",
        params:  [{
          fromBlock:        "latest",
          toBlock:          "latest",
          toAddress:        address,
          category:         ["external", "erc20"],
          withMetadata:     true,
          excludeZeroValue: true,
          maxCount:         "0x5",
          order:            "desc",
        }],
      }

      const res  = await fetch(rpc, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      const txns = json?.result?.transfers ?? []

      if (txns.length === 0) return

      // Check if newest tx is new
      const newest = txns[0]
      if (!newest?.hash || newest.hash === lastHash) return

      // Save latest hash
      localStorage.setItem(LAST_KEY, newest.hash)
      if (!lastHash) return // first run - dont notify

      // Count new txns
      let newCount = 0
      for (const tx of txns) {
        if (tx.hash === lastHash) break
        newCount++
      }
      if (newCount === 0) return

      // Fire notification
      const value  = tx => parseFloat(tx.value ?? 0).toFixed(4)
      const symbol = txns[0].asset ?? chainSymbol
      const amt    = value(txns[0])

      await sendPushNotification(
        "Crypto Received",
        newCount === 1
          ? `You received ${amt} ${symbol} on ${chainId === 1 ? "Ethereum" : chainId === 137 ? "Polygon" : "your wallet"}`
          : `You received ${newCount} new transactions`,
        "tx",
      )

      onNewTx(newCount)
    } catch {}
  }

  // Initial check after 5s, then every 60s
  const timeout  = setTimeout(checkNewTxns, 5000)
  const interval = setInterval(checkNewTxns, 60000)

  return () => {
    clearTimeout(timeout)
    clearInterval(interval)
  }
}

/**
 * Start price watcher - checks every 5 mins
 * Fires alert on 5%+ price movement
 */
export function startPriceWatcher(): () => void {
  const prefs = loadNotifPrefs()
  if (!prefs.priceAlerts || !prefs.pushEnabled) return () => {}

  const LAST_KEY = "kryptonow_last_prices_watch"

  async function checkPrices() {
    try {
      const res  = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network,bitcoin&vs_currencies=usd"
      )
      const data = await res.json()

      const prices: Record<string, number> = {
        eth:   data?.ethereum?.usd         ?? 0,
        bnb:   data?.binancecoin?.usd      ?? 0,
        matic: data?.["matic-network"]?.usd ?? 0,
        btc:   data?.bitcoin?.usd          ?? 0,
      }

      const lastRaw = localStorage.getItem(LAST_KEY)
      const last    = lastRaw ? JSON.parse(lastRaw) : {}

      const alerts: { symbol: string; price: number; change: number }[] = []

      for (const [key, price] of Object.entries(prices)) {
        if (!last[key] || price === 0) continue
        const change = ((price - last[key]) / last[key]) * 100
        if (Math.abs(change) >= 5) {
          alerts.push({ symbol: key.toUpperCase(), price, change })
        }
      }

      // Save current prices
      localStorage.setItem(LAST_KEY, JSON.stringify(prices))

      // Fire one notification per significant move
      for (const alert of alerts.slice(0, 2)) {
        const dir = alert.change > 0 ? "surged" : "dropped"
        await sendPushNotification(
          `${alert.symbol} Price Alert`,
          `${alert.symbol} has ${dir} ${Math.abs(alert.change).toFixed(1)}%  now $${alert.price.toLocaleString()}`,
          "price",
        )
      }
    } catch {}
  }

  // Check every 5 minutes
  const timeout  = setTimeout(checkPrices, 10000) // first check after 10s
  const interval = setInterval(checkPrices, 5 * 60 * 1000)

  return () => {
    clearTimeout(timeout)
    clearInterval(interval)
  }
}

/**
 * Get current push permission status
 */
export async function getPushPermissionStatus(): Promise<"granted" | "denied" | "default"> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied"
    return Notification.permission as "granted" | "denied" | "default"
  }
  try {
    const Notifications = await import("expo-notifications")
    const { status }    = await Notifications.getPermissionsAsync()
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "default"
  } catch { return "default" }
}