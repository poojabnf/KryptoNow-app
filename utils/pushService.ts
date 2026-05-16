/**
 * utils/pushService.ts
 *
 * Expo + FCM push notification service for KryptoNow.
 *
 * Works in 3 modes:
 *   1. Native (iOS/Android)  Expo push tokens via FCM/APNs
 *   2. Web                   Browser Notification API
 *   3. Simulator/dev         Falls back to in-app local notification
 *
 * Dependencies (already installed):
 *   expo-notifications
 *   expo-device
 *   expo-constants
 *
 * To enable real FCM push on native:
 *   1. Add google-services.json (Android) + GoogleService-Info.plist (iOS)
 *      to your project root via EAS
 *   2. Set EXPO_PUBLIC_PUSH_SERVER_URL in .env to your backend endpoint
 *   3. Your backend calls https://exp.host/--/api/v2/push/send with the token
 *
 * Without a backend, push still works in foreground via local notifications.
 */

import { Platform } from 'react-native'
import { addNotification } from './notifications'

//  Types 

type NotifType = 'price' | 'tx' | 'security' | 'news'

type PermissionStatus = 'granted' | 'denied' | 'default'

//  Token storage 

const TOKEN_KEY = 'kn_push_token'

function saveToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}

function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

//  Web: Browser Notification API 

async function requestWebPermission(): Promise<PermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied')  return 'denied'
  const result = await Notification.requestPermission()
  return result as PermissionStatus
}

function getWebPermissionStatus(): PermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission as PermissionStatus
}

function sendWebNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  } catch {}
}

//  Native: Expo Notifications 

async function requestNativePermission(): Promise<PermissionStatus> {
  try {
    const Notifications = await import('expo-notifications')
    const Device        = await import('expo-device')

    // Set foreground notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    if (!Device.isDevice) {
      // Simulator  permission not available but local notifs work
      console.log('[KryptoNow Push] Simulator detected  using local notifications only')
      return 'granted'
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    if (existingStatus === 'granted') {
      await registerForPushToken()
      return 'granted'
    }

    const { status } = await Notifications.requestPermissionsAsync()
    if (status === 'granted') {
      await registerForPushToken()
      return 'granted'
    }

    return status === 'denied' ? 'denied' : 'default'
  } catch (e) {
    console.warn('[KryptoNow Push] Permission error:', e)
    return 'default'
  }
}

async function registerForPushToken(): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications')
    const Constants     = await import('expo-constants')

    const projectId =
      Constants.default.expoConfig?.extra?.eas?.projectId ??
      Constants.default.easConfig?.projectId ??
      undefined

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )

    saveToken(token.data)
    console.log('[KryptoNow Push] Expo push token:', token.data)

    // Send token to your backend
    const serverUrl = process.env.EXPO_PUBLIC_PUSH_SERVER_URL
    if (serverUrl) {
      await fetch(`${serverUrl}/register-token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: token.data }),
      }).catch(() => {}) // fail silently  token saved locally
    }

    return token.data
  } catch (e) {
    console.warn('[KryptoNow Push] Token registration error:', e)
    return null
  }
}

async function getNativePermissionStatus(): Promise<PermissionStatus> {
  try {
    const Notifications = await import('expo-notifications')
    const { status } = await Notifications.getPermissionsAsync()
    return status as PermissionStatus
  } catch {
    return 'default'
  }
}

async function sendNativeNotification(title: string, body: string): Promise<void> {
  try {
    const Notifications = await import('expo-notifications')
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // fire immediately
    })
  } catch (e) {
    console.warn('[KryptoNow Push] Local notification error:', e)
  }
}

//  Public API 
// These are the 3 functions imported by app/notifications.tsx

/**
 * Request push notification permission.
 * Returns true if granted.
 */
export async function requestPushPermission(): Promise<boolean> {
  const status = Platform.OS === 'web'
    ? await requestWebPermission()
    : await requestNativePermission()
  return status === 'granted'
}

/**
 * Get current permission status without prompting.
 */
export async function getPushPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') {
    return getWebPermissionStatus()
  }
  return getNativePermissionStatus()
}

/**
 * Send a push notification immediately.
 * Also adds it to the in-app notification history.
 *
 * @param title  Notification title
 * @param body   Notification body text
 * @param type   Category: 'price' | 'tx' | 'security' | 'news'
 */
export async function sendPushNotification(
  title: string,
  body:  string,
  type:  NotifType = 'news',
): Promise<void> {
  // Always add to in-app history
  addNotification({ title, body, type })

  // Also send OS-level push
  if (Platform.OS === 'web') {
    sendWebNotification(title, body)
  } else {
    await sendNativeNotification(title, body)
  }
}

/**
 * Send a transaction notification.
 * Call this after a tx is confirmed on-chain.
 */
export async function sendTxNotification(
  direction: 'sent' | 'received',
  amount:    string,
  symbol:    string,
  chain:     string,
  hash:      string,
): Promise<void> {
  const title = direction === 'sent'
    ? `Sent ${amount} ${symbol}`
    : `Received ${amount} ${symbol}`
  const body = direction === 'sent'
    ? `${amount} ${symbol} sent on ${chain}`
    : `${amount} ${symbol} received on ${chain}  ${hash.slice(0, 8)}...`
  await sendPushNotification(title, body, 'tx')
}

/**
 * Send a price alert notification.
 */
export async function sendPriceAlert(
  symbol:    string,
  direction: 'up' | 'down',
  pct:       number,
  price:     number,
): Promise<void> {
  const arrow = direction === 'up' ? '' : ''
  const title = `${symbol} ${arrow} ${pct.toFixed(1)}%`
  const body  = `${symbol} is now $${price.toLocaleString()}`
  await sendPushNotification(title, body, 'price')
}

/**
 * Send a security alert.
 */
export async function sendSecurityAlert(message: string): Promise<void> {
  await sendPushNotification('Security Alert', message, 'security')
}

/**
 * Get the stored Expo push token (for sending from backend).
 */
export function getStoredPushToken(): string | null {
  return loadToken()
}

/**
 * Polls the address for new incoming transfers and fires local push notifications.
 * Returns a cleanup function to stop polling.
 */
export function startTxWatcher(
  address: string,
  _chainId: number,
  symbol: string,
  onNewTx?: (count: number) => void,
): () => void {
  if (!address || Platform.OS === 'web') return () => {}

  let cancelled = false
  let lastSeen = 0

  const poll = async () => {
    if (cancelled) return
    try {
      const ak = process.env.EXPO_PUBLIC_ALCHEMY_KEY
      if (!ak) return
      const url = `https://eth-mainnet.g.alchemy.com/v2/${ak}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toAddress: address,
            category: ['external', 'erc20'],
            maxCount: '0x5',
            order: 'desc',
          }],
        }),
      })
      const data = await res.json()
      const transfers = data?.result?.transfers ?? []
      const fresh = transfers.filter(
        (t: { blockNum?: string }) => parseInt(t.blockNum ?? '0', 16) > lastSeen,
      )
      if (fresh.length > 0) {
        const newest = Math.max(...fresh.map((t: { blockNum?: string }) => parseInt(t.blockNum ?? '0', 16)))
        if (lastSeen > 0) {
          for (const t of fresh) {
            const val = t.value ?? '?'
            const asset = t.asset ?? symbol
            await sendTxNotification('received', String(val), asset, 'Ethereum', t.hash ?? '')
          }
          onNewTx?.(fresh.length)
        }
        lastSeen = newest
      } else if (transfers.length > 0 && lastSeen === 0) {
        lastSeen = parseInt(transfers[0].blockNum ?? '0', 16)
      }
    } catch {
      // polling is best-effort
    }
  }

  void poll()
  const id = setInterval(poll, 30_000)
  return () => {
    cancelled = true
    clearInterval(id)
  }
}
