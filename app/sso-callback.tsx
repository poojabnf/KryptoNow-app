import { useEffect } from "react"
import { View, ActivityIndicator, Text, StyleSheet } from "react-native"
import { useAuth } from "@clerk/expo"
import AsyncStorage from "@react-native-async-storage/async-storage"

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    const redirect = async () => {
      try {
        if (isSignedIn) {
          const address = await AsyncStorage.getItem("kryptonow_address")
          const profileRaw = await AsyncStorage.getItem("kryptonow_profile")
          const profile = profileRaw ? JSON.parse(profileRaw) : null
          if (!address) window.location.href = "/create"
          else if (!profile?.onboarded) window.location.href = "/onboarding"
          else window.location.href = "/dashboard"
        } else {
          window.location.href = "/sign-in"
        }
      } catch { window.location.href = "/create" }
    }
    redirect()
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