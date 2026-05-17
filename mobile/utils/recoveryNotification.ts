/**
 * utils/recoveryNotification.ts
 * ------------------------------
 * Push notification helpers for Social Recovery.
 * Sends local notifications when recovery events happen.
 * Uses expo-notifications (already in package.json).
 */
import { Platform } from 'react-native'

async function getNotifications() {
  if (Platform.OS === 'web') return null
  return import('expo-notifications')
}

export async function notifyRecoveryInitiated(
  guardianNickname: string,
  newOwnerAddr:     string,
  requestId:        string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recovery Request Initiated',
      body:  `A recovery request has been created to transfer ownership to ${newOwnerAddr.slice(0,8)}...`,
      data:  { type: 'recovery_initiated', requestId, newOwnerAddr },
    },
    trigger: null,
  })
}

export async function notifyGuardianSignRequired(
  threshold:    number,
  sigsReceived: number,
  requestId:    string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Guardian Signature Required',
      body:  `${sigsReceived}/${threshold} signatures collected. ${threshold - sigsReceived} more needed.`,
      data:  { type: 'recovery_sig_needed', requestId },
    },
    trigger: null,
  })
}

export async function notifyRecoveryComplete(
  newOwnerAddr: string,
  txHash:       string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wallet Recovery Complete',
      body:  `Ownership transferred to ${newOwnerAddr.slice(0,8)}...${newOwnerAddr.slice(-6)}`,
      data:  { type: 'recovery_complete', txHash },
    },
    trigger: null,
  })
}

export async function notifyRecoveryCancelled(): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recovery Request Cancelled',
      body:  'A recovery request for your wallet has been cancelled.',
      data:  { type: 'recovery_cancelled' },
    },
    trigger: null,
  })
}
