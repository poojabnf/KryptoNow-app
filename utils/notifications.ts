import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface NotifPrefs {
  priceAlerts: boolean
  txAlerts: boolean
  securityAlerts: boolean
  newsAlerts: boolean
  pushEnabled: boolean
}

export interface NotifRecord {
  id: string
  title: string
  body: string
  type: 'price' | 'tx' | 'security' | 'news'
  read: boolean
  timestamp: number
}

export const DEFAULT_PREFS: NotifPrefs = {
  priceAlerts: true,
  txAlerts: true,
  securityAlerts: true,
  newsAlerts: false,
  pushEnabled: false,
}

const PREFS_KEY = 'Kryptonow_notif_prefs'
const HISTORY_KEY = 'Kryptonow_notif_history'

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null
  try {
    const Notifications = require('expo-notifications')
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null
    const token = await Notifications.getExpoPushTokenAsync()
    return token.data
  } catch {
    return null
  }
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

export async function loadNotifHistory(): Promise<NotifRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as NotifRecord[]
  } catch {
    return []
  }
}

export async function markAllRead(): Promise<void> {
  try {
    const history = await loadNotifHistory()
    const updated = history.map(n => ({ ...n, read: true }))
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {}
}

