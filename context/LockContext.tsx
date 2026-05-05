import React, { createContext, useContext, useState, useEffect } from 'react'
import { Platform } from 'react-native'

const PIN_KEY = 'kryptonow_pin_hash'

function hashPin(pin: string): string {
  let h = 7
  for (let i = 0; i < pin.length; i++) {
    h = h * 31 + pin.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16)
}

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch {}
}
function storageRemove(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

type LockState = 'locked' | 'unlocked' | 'no_pin'

type LockContextType = {
  lockState:      LockState
  hasPin:         boolean
  biometricAvail: boolean
  biometricType:  string
  unlock:         (pin: string) => Promise<boolean>
  lock:           () => void
  savePin:        (pin: string) => Promise<void>
  clearPin:       () => void
  verifyPin:      (pin: string) => Promise<boolean>
  biometricUnlock:() => Promise<void>
}

const LockContext = createContext<LockContextType>({
  lockState:       'no_pin',
  hasPin:          false,
  biometricAvail:  false,
  biometricType:   '',
  unlock:          async () => true,
  lock:            () => {},
  savePin:         async () => {},
  clearPin:        () => {},
  verifyPin:       async () => true,
  biometricUnlock: async () => {},
})

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [lockState,      setLockState]      = useState<LockState>('no_pin')
  const [hasPin,         setHasPin]         = useState(false)
  const [biometricAvail, setBiometricAvail] = useState(false)

  useEffect(() => {
    const stored = storageGet(PIN_KEY)
    if (stored) {
      setHasPin(true)
      setLockState('locked')
    } else {
      setLockState('no_pin')
    }
  }, [])

  async function savePin(pin: string) {
    const hash = hashPin(pin)
    storageSet(PIN_KEY, hash)
    setHasPin(true)
    setLockState('unlocked')
  }

  function clearPin() {
    storageRemove(PIN_KEY)
    setHasPin(false)
    setLockState('no_pin')
  }

  async function verifyPin(pin: string): Promise<boolean> {
    const stored = storageGet(PIN_KEY)
    if (!stored) return true
    return hashPin(pin) === stored
  }

  async function unlock(pin: string): Promise<boolean> {
    const ok = await verifyPin(pin)
    if (ok) setLockState('unlocked')
    return ok
  }

  function lock() {
    if (hasPin) setLockState('locked')
  }

  async function biometricUnlock() {
    // Web doesn't support biometrics  skip
    setLockState('unlocked')
  }

  return (
    <LockContext.Provider value={{
      lockState, hasPin, biometricAvail,
      biometricType: '',
      unlock, lock, savePin, clearPin, verifyPin, biometricUnlock,
    }}>
      {children}
    </LockContext.Provider>
  )
}

export function useLockContext() {
  return useContext(LockContext)
}
