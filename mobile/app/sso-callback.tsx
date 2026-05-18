import { useEffect } from "react"
import { View, ActivityIndicator, Text, StyleSheet } from "react-native"
import { useAuth } from "@clerk/expo"
import { storage } from "../utils/storage"

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    const redirect = async () => {
      try {
        if (isSignedIn) {
          const walletRaw = await storage.get("kryptonow_wallet")
          let address = await storage.get("kryptonow_address")
          if (walletRaw && !address) {
            try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
          }
          const profileRaw = await storage.get("kryptonow_profile")
          const profile = profileRaw ? JSON.parse(profileRaw) : null
          
          let dest = "/create"
          if (address) {
            if (!profile?.onboarded) dest = "/onboarding"
            else dest = "/dashboard"
          }

          // Check if we are running inside an OAuth popup window
          if (typeof window !== "undefined" && window.opener && window.opener !== window) {
            try {
              window.opener.location.href = dest
            } catch {
              // Fallback postMessage
              window.opener.postMessage({ type: "KRYPTONOW_AUTH_SUCCESS", dest }, "*")
            }
            // Close popup after brief delay
            setTimeout(() => {
              window.close()
            }, 300)
          } else {
            // Normal fallback redirect
            window.location.href = dest
          }
        } else {
          if (typeof window !== "undefined" && window.opener && window.opener !== window) {
            window.close()
          } else {
            window.location.href = "/sign-in"
          }
        }
      } catch {
        if (typeof window !== "undefined" && window.opener && window.opener !== window) {
          window.close()
        } else {
          window.location.href = "/create"
        }
      }
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