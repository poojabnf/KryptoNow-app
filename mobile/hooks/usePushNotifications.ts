import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { useWalletStore } from '../store/walletStore';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const address = useWalletStore(s => s.address);

  useEffect(() => {
    if (Platform.OS === 'web' || !Device.isDevice) {
      console.log('[FCM] Push notifications not supported on Web or Simulator');
      return;
    }

    let isMounted = true;

    async function requestPermissionsAndGetToken() {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          const token = await messaging().getToken();
          if (isMounted) {
            setFcmToken(token);
            console.log('[FCM] Device Token:', token);
            // Push token ready  store in AsyncStorage for local use
  // Wire to your backend when ready: POST /api/push-token { token, walletAddress }
            // e.g., fetch('your-backend.com/api/register-device', { method: 'POST', body: JSON.stringify({ token, address }) })
          }
        }
      } catch (error) {
        console.error('[FCM] Failed to get push token:', error);
      }
    }

    requestPermissionsAndGetToken();

    // Listen for incoming foreground messages
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('[FCM] A new FCM message arrived!', JSON.stringify(remoteMessage));
      
      // Manually trigger local notification if needed, though expo-notifications handles most cases
      if (remoteMessage.notification) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title,
            body: remoteMessage.notification.body,
            data: remoteMessage.data,
          },
          trigger: null, // Send immediately
        });
      }
    });

    // Listen for token refreshes
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
      setFcmToken(token);
      console.log('[FCM] Token refreshed:', token);
    });

    return () => {
      isMounted = false;
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, [address]);

  return { fcmToken };
}