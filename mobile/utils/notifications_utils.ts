/**
 * utils/notifications.ts + app/notifications.tsx
 * Push notifications via Expo + FCM
 * Install: npx expo install expo-notifications expo-device expo-constants
 */

// ════════════════════════════════════════════════════════════════════════════
// utils/notifications.ts — notification logic, background polling
// ════════════════════════════════════════════════════════════════════════════

import * as Notifications from 'expo-notifications'
import * as Device        from 'expo-device'
import Constants          from 'expo-constants'
import AsyncStorage       from '@react-native-async-storage/async-storage'
import { Platform }       from 'react-native'
import { ethers }         from 'ethers'

const STORAGE_KEYS = {
  PUSH_TOKEN:       'Kryptonow_push_token',
  LAST_BLOCK:       'Kryptonow_last_block_',   // + chainId
  NOTIF_PREFS:      'Kryptonow_notif_prefs',
  NOTIF_HISTORY:    'Kryptonow_notif_history',
}

export type NotifPrefs = {
  txAlerts:        boolean   // any transaction in/out
  largeTransfer:   boolean   // transfers above threshold
  largeThreshold:  number    // USD value
  priceAlerts:     boolean   // ETH price change %
  priceThreshold:  number    // % change to trigger
  securityAlerts:  boolean   // new device connection etc
}

export const DEFAULT_PREFS: NotifPrefs = {
  txAlerts:       true,
  largeTransfer:  true,
  largeThreshold: 500,    // $500 USD
  priceAlerts:    false,
  priceThreshold: 5,      // 5% price change
  securityAlerts: true,
}

export type NotifRecord = {
  id:        string
  type:      'tx_in' | 'tx_out' | 'large_transfer' | 'price_alert' | 'security'
  title:     string
  body:      string
  timestamp: number
  read:      boolean
  data?:     Record<string, string>
}

// ─── Configure notification handler ──────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

// ─── Register for push notifications ─────────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device')
    return null
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('Kryptonow-default', {
      name:            'Kryptonow Alerts',
      importance:      Notifications.AndroidImportance.HIGH,
      vibrationPattern:[0, 250, 250, 250],
      lightColor:      '#6366F1',
      sound:           'default',
    })
    await Notifications.setNotificationChannelAsync('Kryptonow-security', {
      name:       'Security Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound:      'default',
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? 'VGjJDYaDGICLFedxqQafJui22P4tEpIIb7TP9DOm',
  })

  await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token.data)
  return token.data
}

// ─── Send local notification ──────────────────────────────────────────────────
async function sendLocal(
  title:   string,
  body:    string,
  data?:   Record<string, string>,
  channel: string = 'Kryptonow-default'
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: channel } : {}) },
    trigger: null,  // immediately
  })
  // Save to history
  const record: NotifRecord = {
    id:        `notif-${Date.now()}`,
    type:      (data?.type as any) ?? 'tx_in',
    title, body,
    timestamp: Date.now(),
    read:      false,
    data,
  }
  const raw      = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_HISTORY)
  const history: NotifRecord[] = raw ? JSON.parse(raw) : []
  history.unshift(record)
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_HISTORY, JSON.stringify(history.slice(0, 100)))
}

// ─── Load/save prefs ──────────────────────────────────────────────────────────
export async function loadNotifPrefs(): Promise<NotifPrefs> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_PREFS)
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
}
export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_PREFS, JSON.stringify(prefs))
}
export async function loadNotifHistory(): Promise<NotifRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_HISTORY)
  return raw ? JSON.parse(raw) : []
}
export async function markAllRead(): Promise<void> {
  const history = await loadNotifHistory()
  const updated = history.map(n => ({ ...n, read: true }))
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_HISTORY, JSON.stringify(updated))
  await Notifications.setBadgeCountAsync(0)
}

// ─── Background transaction polling ──────────────────────────────────────────
// Called from a background task (register with expo-task-manager)
export async function pollForNewTransactions(
  address:  string,
  chainId:  number,
  rpc:      string,
): Promise<void> {
  const prefs = await loadNotifPrefs()
  if (!prefs.txAlerts && !prefs.largeTransfer) return

  try {
    const provider   = new ethers.JsonRpcProvider(rpc, { chainId: chainId, name: 'unknown' }, { staticNetwork: true })
    const currentBlock = await provider.getBlockNumber()
    const lastBlockKey = STORAGE_KEYS.LAST_BLOCK + chainId
    const lastBlockRaw = await AsyncStorage.getItem(lastBlockKey)
    const lastBlock    = lastBlockRaw ? parseInt(lastBlockRaw) : currentBlock - 1

    if (currentBlock <= lastBlock) return

    // Fetch logs for ETH transfers to/from address in new blocks
    const logs = await provider.getLogs({
      fromBlock: lastBlock + 1,
      toBlock:   currentBlock,
      address:   [],  // native ETH transfers detected via block scanning
    })

    // Also scan each new block for native transfers
    for (let b = lastBlock + 1; b <= Math.min(currentBlock, lastBlock + 5); b++) {
      try {
        const block = await provider.getBlock(b, true)
        if (!block?.transactions) continue

        for (const tx of block.transactions as any[]) {
          const isIncoming  = tx.to?.toLowerCase()   === address.toLowerCase()
          const isOutgoing  = tx.from?.toLowerCase() === address.toLowerCase()
          if (!isIncoming && !isOutgoing) continue

          const ethValue    = parseFloat(ethers.formatEther(tx.value ?? 0n))
          const shortHash   = tx.hash.slice(0, 10) + '…'
          const counterpart = isIncoming
            ? (tx.from.slice(0, 6) + '…' + tx.from.slice(-4))
            : (tx.to?.slice(0, 6) + '…' + tx.to?.slice(-4))

          // Get ETH price for USD estimate
          let usdValue = 0
          try {
            const p = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
            const d = await p.json()
            usdValue = ethValue * (d.ethereum?.usd ?? 0)
          } catch {}

          if (prefs.txAlerts) {
            if (isIncoming) {
              await sendLocal(
                '💸 Received ETH',
                `+${ethValue.toFixed(4)} ETH${usdValue > 0 ? ` (~$${usdValue.toFixed(2)})` : ''} from ${counterpart}`,
                { type: 'tx_in', hash: tx.hash, chainId: String(chainId) }
              )
            } else if (isOutgoing) {
              await sendLocal(
                '↑ Transaction Sent',
                `${ethValue.toFixed(4)} ETH to ${counterpart} · ${shortHash}`,
                { type: 'tx_out', hash: tx.hash, chainId: String(chainId) }
              )
            }
          }

          // Large transfer alert (separate, higher priority)
          if (prefs.largeTransfer && usdValue >= prefs.largeThreshold) {
            await sendLocal(
              `🚨 Large Transfer: $${usdValue.toFixed(0)}`,
              `${ethValue.toFixed(4)} ETH ${isIncoming ? 'received from' : 'sent to'} ${counterpart}`,
              { type: 'large_transfer', hash: tx.hash, chainId: String(chainId) },
              'Kryptonow-security'
            )
          }
        }
      } catch {}
    }

    await AsyncStorage.setItem(lastBlockKey, String(currentBlock))
  } catch (e) {
    console.warn('pollForNewTransactions error:', e)
  }
}

// ─── Price alert check ────────────────────────────────────────────────────────
export async function checkPriceAlert(): Promise<void> {
  const prefs = await loadNotifPrefs()
  if (!prefs.priceAlerts) return

  try {
    const key     = 'Kryptonow_last_eth_price'
    const lastRaw = await AsyncStorage.getItem(key)
    const lastPrice = lastRaw ? parseFloat(lastRaw) : null

    const res   = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true')
    const data  = await res.json()
    const price = data.ethereum?.usd ?? 0
    const change= data.ethereum?.usd_24h_change ?? 0

    await AsyncStorage.setItem(key, String(price))

    if (lastPrice && Math.abs(change) >= prefs.priceThreshold) {
      const dir = change > 0 ? '📈' : '📉'
      await sendLocal(
        `${dir} ETH ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%`,
        `ETH is now $${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        { type: 'price_alert' }
      )
    }
  } catch {}
}

export { Notifications }

// ════════════════════════════════════════════════════════════════════════════
// Below: the Notifications Settings Screen (app/notifications.tsx)
// Copy everything below this line into app/notifications.tsx
// ════════════════════════════════════════════════════════════════════════════



