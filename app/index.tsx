import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@clerk/expo"

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key) } catch { return null }
  }
  const AsyncStorage = require("@react-native-async-storage/async-storage").default
  return AsyncStorage.getItem(key)
}

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.replace("/(auth)/sign-in")
      return
    }

    // Only check wallet if signed in
    ;(async () => {
      // Try kryptonow_wallet (new format) then fallback to kryptonow_address (legacy)
      const walletRaw = await getItem("kryptonow_wallet")
      const legacyAddr = await getItem("kryptonow_address")

      let address: string | null = null
      if (walletRaw) {
        try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
      }
      if (!address) address = legacyAddr

      console.log("[KryptoNow] wallet address:", address ? "EXISTS" : "NULL")

      if (!address) {
        router.replace("/create")
        return
      }

      const { useWalletStore } = require("../store/walletStore")
      const store = useWalletStore.getState()
      if (!store.address) {
        store.setWallet({ address, phrase: "" })
      }

      const profileRaw = await getItem("kryptonow_profile")
      const profile = profileRaw ? JSON.parse(profileRaw) : null

      if (!profile?.onboarded) {
        router.replace("/onboarding")
        return
      }

      router.replace("/dashboard")
    })()
  }, [isLoaded, isSignedIn])

  return (
    <View style={s.c}>
      <ActivityIndicator size="large" color="#00D4AA" />
    </View>
  )
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#0D2E2E", alignItems: "center", justifyContent: "center" },
})