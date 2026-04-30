const fs = require('fs')
const path = require('path')

// Create hooks folder if it doesn't exist
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
      const redirectUrl = Linking.createURL("/oauth-callback", { scheme: "Kryptonow" })
      console.log("Redirect URL:", redirectUrl)

      const { createdSessionId, setActive } = await startOAuthFlow({ redirectUrl })

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        console.log("Signed in successfully")
      }
    } catch (err) {
      console.error("OAuth error:", JSON.stringify(err))
      Alert.alert("Sign in failed", err.message || "Something went wrong. Please try again.")
    }
  }, [startOAuthFlow])

  return { signInWithGoogle }
}
`

fs.writeFileSync(path.join('hooks', 'useGoogleAuth.ts'), hook)
console.log('hooks/useGoogleAuth.ts created')

