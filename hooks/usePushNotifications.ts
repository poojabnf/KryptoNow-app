import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { useWalletStore } from '../store/walletStore'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const address = useWalletStore(s => s.address)

  useEffect(() => {
    if (Platform.OS === 'web' || !Device.isDevice) return

    let isMounted = true

    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted')
        return
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) {
        console.warn('[Push] No EAS projectId in app config — push tokens unavailable')
        return
      }

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
        if (isMounted) {
          setExpoPushToken(token)
          console.log('[Push] Expo push token:', token)
          // Register with your backend when ready:
          // await fetch('https://api.kryptonow.xyz/devices', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ token, walletAddress: address }),
          // })
        }
      } catch (e) {
        console.error('[Push] Failed to get push token:', e)
      }
    }

    register()

    const sub = Notifications.addNotificationReceivedListener(n => {
      console.log('[Push] Received:', n.request.content.title)
    })

    return () => {
      isMounted = false
      sub.remove()
    }
  }, [address])

  return { expoPushToken }
}
