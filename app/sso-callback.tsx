import { useEffect } from "react"
import { View, ActivityIndicator, Text, StyleSheet, Platform } from "react-native"
import { useAuth } from "@clerk/expo"
import { router } from "expo-router"

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null
    }
    const AS = require("@react-native-async-storage/async-storage").default
    return AS.getItem(key)
  } catch { return null }
}

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    ;(async () => {
      try {
        if (!isSignedIn) {
          router.replace("/(auth)/sign-in")
          return
        }

        // Check both storage keys (new format + legacy)
        const walletRaw  = await getItem("kryptonow_wallet")
        const legacyAddr = await getItem("kryptonow_address")

        let address: string | null = null
        if (walletRaw) {
          try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
        }
        if (!address) address = legacyAddr

        if (!address) {
          router.replace("/create")
          return
        }

        const profileRaw = await getItem("kryptonow_profile")
        const profile    = profileRaw ? JSON.parse(profileRaw) : null

        if (!profile?.onboarded) {
          router.replace("/onboarding")
          return
        }

        router.replace("/dashboard")
      } catch {
        router.replace("/create")
      }
    })()
  }, [isLoaded, isSignedIn])

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#00D4AA" />
      <Text style={s.text}>Completing sign in...</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D2E2E", alignItems: "center", justifyContent: "center", gap: 16 },
  text:      { color: "#00D4AA", fontSize: 16, fontWeight: "600" },
})
