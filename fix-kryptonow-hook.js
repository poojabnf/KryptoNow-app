const fs = require('fs')

if (!fs.existsSync('hooks')) fs.mkdirSync('hooks')

const hook = `import { useOAuth } from "@clerk/expo"
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
      console.log("=== KRYPTONOW AUTH DEBUG ===")
      console.log("Redirect URL:", redirectUrl)

      const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow({ redirectUrl })

      console.log("createdSessionId:", createdSessionId)
      console.log("signIn:", signIn ? "present" : "null")
      console.log("signUp:", signUp ? "present" : "null")

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        console.log("SUCCESS - signed in!")
      } else if (signIn) {
        Alert.alert("Extra step needed", "signIn: " + JSON.stringify(signIn.status))
      } else if (signUp) {
        Alert.alert("Extra step needed", "signUp: " + signUp.status)
      } else {
        Alert.alert("Unknown state", "Please check terminal logs")
      }
    } catch (err) {
      console.log("=== KRYPTONOW AUTH ERROR ===")
      console.log("Message:", err.message)
      console.log("Code:", err.code)
      console.log("Full:", JSON.stringify(err, null, 2))
      Alert.alert(
        "Sign in failed",
        "Code: " + (err.code || "none") +
        "\\nMessage: " + (err.message || "unknown")
      )
    }
  }, [startOAuthFlow])

  return { signInWithGoogle }
}
`

fs.writeFileSync('hooks/useGoogleAuth.ts', hook)
console.log('✓ hooks/useGoogleAuth.ts updated for KryptoNow')
