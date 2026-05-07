import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

interface LockContextType {
  isUnlocked: boolean;
  requireUnlock: () => Promise<boolean>;
}

const LockContext = createContext<LockContextType>({
  isUnlocked: true,
  requireUnlock: async () => true,
});

export function LockProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (compatible && enrolled) {
          setIsSupported(true);
          setIsUnlocked(false); // Lock initially if biometrics are configured
        }
      }
    })();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Re-lock the app if it comes back from the background
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
         if (Platform.OS !== 'web' && isSupported) {
           setIsUnlocked(false);
         }
      }
      setAppState(nextAppState);
    });

    return () => subscription.remove();
  }, [appState, isSupported]);

  useEffect(() => {
    if (!isUnlocked && isSupported) {
      requireUnlock();
    }
  }, [isUnlocked, isSupported]);

  const requireUnlock = async () => {
    if (Platform.OS === 'web' || !isSupported) {
      setIsUnlocked(true);
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock KryptoNow',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  return (
    <LockContext.Provider value={{ isUnlocked, requireUnlock }}>
      {children}
      {!isUnlocked && (
        <View style={styles.overlay}>
          <View style={styles.shield}>
            <Text style={styles.shieldIcon}></Text>
          </View>
          <Text style={styles.title}>KryptoNow is Locked</Text>
          <Text style={styles.sub}>Authenticate to access your funds safely.</Text>
          <TouchableOpacity style={styles.btn} onPress={requireUnlock}>
            <Text style={styles.btnText}>Unlock Wallet</Text>
          </TouchableOpacity>
        </View>
      )}
    </LockContext.Provider>
  );
}

export const useLock = () => useContext(LockContext);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D2E2E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Ensure it sits above absolutely everything
    padding: 24,
  },
  shield: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(0, 212, 170, 0.3)'
  },
  shieldIcon: { fontSize: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: '#A0C4C4', marginBottom: 32, textAlign: 'center' },
  btn: { backgroundColor: '#00D4AA', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  btnText: { color: '#0D2E2E', fontSize: 16, fontWeight: '700' },
});