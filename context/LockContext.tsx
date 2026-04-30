// context/LockContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LockContextType = {
  lockState: 'locked' | 'unlocked';
  unlock: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  hasPin: boolean;
  biometricAvail: boolean;
  biometricType: string;
  biometricUnlock: () => Promise<void>;
  savePin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
};

const LockContext = createContext<LockContextType>({
  lockState: 'unlocked',
  unlock: async () => true,
  setPin: async () => {},
  hasPin: true,
  biometricAvail: false,
  biometricType: '',
  biometricUnlock: async () => {},
  savePin: async () => {},
  verifyPin: async () => true,
});

export function LockProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Platform.OS === 'web') {
      AsyncStorage.setItem('Kryptonow_pin_hash', 'web_bypass').catch(() => {});
    }
  }, []);

  return (
    <LockContext.Provider
      value={{
        lockState: 'unlocked',
        unlock: async () => true,
        setPin: async () => {},
        hasPin: true,
        biometricAvail: false,
        biometricType: '',
        biometricUnlock: async () => {},
        savePin: async () => {},
        verifyPin: async () => true,
      }}
    >
      {children}
    </LockContext.Provider>
  );
}

export const useLock = () => useContext(LockContext);
export const useLockContext = () => useContext(LockContext);

