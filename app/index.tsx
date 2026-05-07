import { useEffect, useRef } from "react"
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@clerk/expo"
import * as WebBrowser from "expo-web-browser"

if (Platform.OS === "web" && typeof window !== "undefined") {
  WebBrowser.maybeCompleteAuthSession()
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key) } catch { return null }
  }
  const AS = require("@react-native-async-storage/async-storage").default
  return AS.getItem(key)
}

async function getDestination(): Promise<string> {
  try {
    const walletRaw  = await getItem("kryptonow_wallet")
    const legacyAddr = await getItem("kryptonow_address")
    let address: string | null = null
    if (walletRaw) {
      try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
    }
    if (!address) address = legacyAddr
    if (!address) return "/create"
    const profileRaw = await getItem("kryptonow_profile")
    const profile    = profileRaw ? JSON.parse(profileRaw) : null
    if (!profile?.onboarded) return "/onboarding"
    return "/dashboard"
  } catch { return "/create" }
}

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth()
  const router   = useRouter()
  const handled  = useRef(false)

  useEffect(() => {
    if (!isLoaded || handled.current) return
    handled.current = true

    const isWeb   = Platform.OS === "web"
    const isPopup = isWeb && typeof window !== "undefined"
                    && window.opener != null
                    && window.opener !== window

    if (isPopup) {
      //  POPUP WINDOW 
      // This is the OAuth callback popup. Signal parent then close.
      const handlePopup = async () => {
        if (isSignedIn) {
          const dest = await getDestination()
          // Try to redirect parent window
          try { window.opener.location.href = dest } catch {}
          try { window.opener.postMessage({ type: "KRYPTONOW_AUTH_SUCCESS", dest }, "*") } catch {}
          setTimeout(() => { try { window.close() } catch {} }, 400)
        } else {
          // Session not ready yet in popup  just close, let parent handle via startSSOFlow
          try { window.opener.postMessage({ type: "KRYPTONOW_POPUP_CLOSED" }, "*") } catch {}
          setTimeout(() => { try { window.close() } catch {} }, 200)
        }
      }
      handlePopup()
      return
    }

    //  NORMAL WINDOW 
    if (!isSignedIn) {
      router.replace("/sign-in")
      return
    }

    getDestination().then(dest => {
      if (dest === "/dashboard") {
        const { useWalletStore } = require("../store/walletStore")
        const store = useWalletStore.getState()
        getItem("kryptonow_wallet").then(raw => {
          if (raw && !store.address) {
            try { store.setWallet({ address: JSON.parse(raw)?.address, phrase: "" }) } catch {}
          }
        })
      }
      router.replace(dest as any)
    })
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