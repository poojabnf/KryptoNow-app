import { useState, useEffect, useCallback } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const PIN_KEY      = 'Kryptonow_pin_hash'
const LOCK_TIMEOUT = 30 * 1000  // 30 seconds background → re-lock

// Simple hash (PIN never stored plain)
function hashPin(pin: string): string {
  let h = 7
  for (let i = 0; i < pin.length; i++) {
    h = h * 31 + pin.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16)
}

export type LockState = 'locked' | 'unlocked' | 'no_pin'

export function useLock() {
  const [lockState,     setLockState]     = useState<LockState>('locked')
  const [biometricAvail, setBiometricAvail] = useState(false)
  const [biometricType,  setBiometricType]  = useState<string>('Biometrics')
  const [lastActive,     setLastActive]     = useState(Date.now())

  // ── On mount: check what's available ──────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const hasHw   = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      setBiometricAvail(hasHw && enrolled)

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID')
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint')
      }

      if (Platform.OS === 'web') { setLockState('unlocked'); return; }
      if (Platform.OS === 'web') { setLockState('unlocked'); return; }
      if (Platform.OS === 'web') { setLockState('unlocked'); return; }
      if (Platform.OS === 'web') { setLockState('unlocked'); return; }
      const storedPin = await SecureStore.getItemAsync(PIN_KEY)
      if (!storedPin) {
        setLockState('no_pin')
      } else {
        setLockState('locked')
      }
    })()
  }, [])

  // ── Save PIN ───────────────────────────────────────────────────────────────
  const savePin = useCallback(async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, hashPin(pin))
    setLockState('unlocked')
  }, [])

  // ── Verify PIN ─────────────────────────────────────────────────────────────
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(PIN_KEY)
    const match  = stored === hashPin(pin)
    if (match) { setLockState('unlocked'); setLastActive(Date.now()) }
    return match
  }, [])

  // ── Biometric unlock ───────────────────────────────────────────────────────
  const biometricUnlock = useCallback(async (): Promise<boolean> => {
    if (!biometricAvail) return false
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:    'Unlock Kryptonow',
        fallbackLabel:    'Use PIN',
        cancelLabel:      'Cancel',
        disableDeviceFallback: false,
      })
      if (result.success) {
        setLockState('unlocked')
        setLastActive(Date.now())
      }
      return result.success
    } catch {
      return false
    }
  }, [biometricAvail])

  // ── Lock ───────────────────────────────────────────────────────────────────
  const lock = useCallback(() => setLockState('locked'), [])

  // ── Auto-lock on inactivity ────────────────────────────────────────────────
  const touchActivity = useCallback(() => setLastActive(Date.now()), [])

  useEffect(() => {
    if (lockState !== 'unlocked') return
    const timer = setInterval(() => {
      if (Date.now() - lastActive > LOCK_TIMEOUT) lock()
    }, 5000)
    return () => clearInterval(timer)
  }, [lockState, lastActive, lock])

  return {
    lockState,
    biometricAvail,
    biometricType,
    savePin,
    verifyPin,
    biometricUnlock,
    lock,
    touchActivity,
  }
}


