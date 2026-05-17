import { useOAuth } from "@clerk/expo"
import { useCallback } from "react"
import { Alert } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as Linking from "expo-linking"

WebBrowser.maybeCompleteAuthSession()

export function useGoogleAuth() {
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" })

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL("/oauth-callback", { scheme: "kryptonow" })
      console.log("=== KRYPTONOW AUTH ===")
      console.log("Redirect URL:", redirectUrl)

      const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow({ redirectUrl })

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        console.log("Signed in successfully")
      } else if (signIn) {
        Alert.alert("Extra step", "signIn status: " + signIn.status)
      } else if (signUp) {
        Alert.alert("Extra step", "signUp status: " + signUp.status)
      }
    } catch (err) {
      console.log("Auth error:", JSON.stringify(err, null, 2))
      Alert.alert("Sign in failed", (err as any)?.message || "Something went wrong")
    }
  }, [startOAuthFlow])

  return { signInWithGoogle }
}
