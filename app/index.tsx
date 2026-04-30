import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG = (tag: string, msg: string, data?: any) => {
  if (data !== undefined) console.log(`[KryptoNow][${tag}] ${msg}`, JSON.stringify(data, null, 2));
  else console.log(`[KryptoNow][${tag}] ${msg}`);
};

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    LOG("Index", "Mounted", { isLoaded, isSignedIn });
  }, []);

  useEffect(() => {
    LOG("Index", "Auth state changed", { isLoaded, isSignedIn });
    if (!isLoaded) {
      LOG("Index", "⏳ Waiting for Clerk...");
      return;
    }

    (async () => {
      if (!isSignedIn) {
        LOG("Index", "🔒 Not signed in → redirecting to sign-in");
        router.replace('/(auth)/sign-in');
        return;
      }

      LOG("Index", "✅ Signed in, checking wallet...");
      const address = await AsyncStorage.getItem('kryptonow_address');
      LOG("Index", "Wallet check", { address: address ? "EXISTS" : "NULL" });

      if (!address) {
        LOG("Index", "💳 No wallet → /create");
        router.replace('/create');
        return;
      }

      const profileRaw = await AsyncStorage.getItem('kryptonow_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : null;
      LOG("Index", "Profile check", { onboarded: profile?.onboarded ?? false });

      if (!profile?.onboarded) {
        LOG("Index", "📋 Not onboarded → /onboarding");
        router.replace('/onboarding');
        return;
      }

      LOG("Index", "🏠 All good → /dashboard");
      router.replace('/dashboard');
    })();
  }, [isLoaded, isSignedIn]);

  return (
    <View style={s.c}>
      <ActivityIndicator size="large" color="#00D4AA" />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0D2E2E', alignItems: 'center', justifyContent: 'center' },
});