import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet, Platform, Image } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../context/AuthContext"
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

  // Safety timeout — if Clerk hasn't loaded in 4 s, go to sign-in anyway
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isLoaded) router.replace("/sign-in")
    }, 4000)
    return () => clearTimeout(t)
  }, [isLoaded])

  useEffect(() => {
    if (Platform.OS !== "web") return
    // Popup detection — close OAuth popup and redirect parent
    if (typeof window !== "undefined" && window.opener && window.opener !== window) {
      const handlePopup = async () => {
        if (!isLoaded) return
        try {
          if (isSignedIn) {
            const walletRaw  = await getItem("kryptonow_wallet")
            const legacyAddr = await getItem("kryptonow_address")
            let address: string | null = null
            if (walletRaw) { try { address = JSON.parse(walletRaw)?.address ?? null } catch {} }
            if (!address) address = legacyAddr
            const profileRaw = await getItem("kryptonow_profile")
            const profile    = profileRaw ? JSON.parse(profileRaw) : null
            const dest = !address ? "/create" : !profile?.onboarded ? "/onboarding" : "/dashboard"
            try { window.opener.location.href = dest }
            catch { window.opener.postMessage({ type: "KRYPTONOW_AUTH_SUCCESS", dest }, "*") }
            setTimeout(() => window.close(), 300)
          } else { window.close() }
        } catch { window.close() }
      }
      handlePopup()
      return
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded) return
    if (typeof window !== "undefined" && window.opener && window.opener !== window) return

    if (!isSignedIn) { router.replace("/sign-in"); return }

    ;(async () => {
      const walletRaw  = await getItem("kryptonow_wallet")
      const legacyAddr = await getItem("kryptonow_address")
      let address: string | null = null
      if (walletRaw) { try { address = JSON.parse(walletRaw)?.address ?? null } catch {} }
      if (!address) address = legacyAddr

      if (!address) { router.replace("/create"); return }

      const { useWalletStore } = require("../store/walletStore")
      const store = useWalletStore.getState()
      await store.initFromStorage()
      if (!store.address && address) useWalletStore.getState().setWallet({ address, phrase: "" })

      const profileRaw = await getItem("kryptonow_profile")
      const profile    = profileRaw ? JSON.parse(profileRaw) : null
      if (!profile?.onboarded) { router.replace("/onboarding"); return }
      router.replace("/dashboard")
    })()
  }, [isLoaded, isSignedIn])

  return (
    <View style={s.c}>
      <Image source={require("../assets/icon.png")} style={s.logo} resizeMode="contain" />
      <ActivityIndicator size="large" color="#00D4AA" style={{ marginTop: 32 }} />
    </View>
  )
}

const s = StyleSheet.create({
  c:    { flex: 1, backgroundColor: "#0D2E2E", alignItems: "center", justifyContent: "center" },
  logo: { width: 96, height: 96, borderRadius: 22 },
})