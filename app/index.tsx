import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@clerk/expo"
import * as WebBrowser from "expo-web-browser"

// Must run immediately - detects OAuth popup and closes it
if (Platform.OS === "web" && typeof window !== "undefined") {
  WebBrowser.maybeCompleteAuthSession()
}

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
    if (Platform.OS !== "web") return

    //  Popup detection 
    // If this page loaded inside an OAuth popup window, close it and
    // redirect the PARENT window to the correct destination
    if (typeof window !== "undefined" && window.opener && window.opener !== window) {
      const handlePopup = async () => {
        if (!isLoaded) return
        try {
          if (isSignedIn) {
            // Get destination for parent window
            const walletRaw  = await getItem("kryptonow_wallet")
            const legacyAddr = await getItem("kryptonow_address")
            let address: string | null = null
            if (walletRaw) {
              try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
            }
            if (!address) address = legacyAddr

            const profileRaw = await getItem("kryptonow_profile")
            const profile    = profileRaw ? JSON.parse(profileRaw) : null
            const dest = !address ? "/create"
              : !profile?.onboarded ? "/onboarding"
              : "/dashboard"

            // Redirect parent window then close popup
            try {
              window.opener.location.href = dest
            } catch {
              // If cross-origin blocked, use postMessage
              window.opener.postMessage({ type: "KRYPTONOW_AUTH_SUCCESS", dest }, "*")
            }
            // Close popup after short delay
            setTimeout(() => window.close(), 300)
          } else {
            // Auth failed - close popup
            window.close()
          }
        } catch {
          window.close()
        }
      }
      handlePopup()
      return
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded) return

    //  Normal page navigation (not a popup) 
    if (typeof window !== "undefined" && window.opener && window.opener !== window) {
      return // handled above
    }

    if (!isSignedIn) {
      router.replace("/sign-in")
      return
    }

    ;(async () => {
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

      const { useWalletStore } = require("../store/walletStore")
      const store = useWalletStore.getState()
      if (!store.address) store.setWallet({ address, phrase: "" })

      const profileRaw = await getItem("kryptonow_profile")
      const profile    = profileRaw ? JSON.parse(profileRaw) : null
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