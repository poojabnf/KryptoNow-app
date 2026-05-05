import { useEffect } from "react"
import { View, ActivityIndicator, Text, StyleSheet } from "react-native"
import { useSSO } from "@clerk/expo"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"

export default function SSOCallback() {
  const { startSSOFlow } = useSSO()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Clerk handles the callback automatically via the token in URL
        // Just check auth state and redirect
        const address = await AsyncStorage.getItem("kryptonow_address")
        const profileRaw = await AsyncStorage.getItem("kryptonow_profile")
        const profile = profileRaw ? JSON.parse(profileRaw) : null

        if (!address) {
          window.location.href = "/create"
        } else if (!profile?.onboarded) {
          window.location.href = "/onboarding"
        } else {
          window.location.href = "/dashboard"
        }
      } catch {
        window.location.href = "/create"
      }
    }

    // Small delay to let Clerk process the callback
    const timer = setTimeout(handleCallback, 1500)
    return () => clearTimeout(timer)
  }, [])

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